<?php

namespace App\Services;

use App\Models\AlertLog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    protected ?string $botToken;
    protected ?string $chatId;

    // Cooldown interval dalam detik untuk status BAHAYA berulang (Anti-Spam)
    protected int $dangerCooldownSeconds = 60;

    public function __construct()
    {
        $this->botToken = config('services.telegram.bot_token', env('TELEGRAM_BOT_TOKEN'));
        $this->chatId   = config('services.telegram.chat_id', env('TELEGRAM_CHAT_ID'));
    }

    /**
     * Mengevaluasi dan mengirimkan notifikasi Telegram jika memenuhi kriteria Anti-Spam / Cooldown.
     *
     * @param string $currentLevel  'AMAN' | 'WASPADA' | 'BAHAYA'
     * @param float $temperature
     * @param float $gasLevel
     * @param bool $fanStatus
     * @param bool $pumpStatus
     * @param array $thresholds
     * @param string|null $macAddress
     * @return bool status pengiriman
     */
    public function handleAlertNotification(
        string $currentLevel,
        float $temperature,
        float $gasLevel,
        bool $fanStatus,
        bool $pumpStatus,
        array $thresholds = [],
        ?string $macAddress = null
    ): bool {
        $previousLevel = Cache::get('telegram_last_alert_level', 'AMAN');
        $lastSentTime  = Cache::get('telegram_last_sent_timestamp', 0);
        $currentTime   = time();

        $shouldNotify = false;
        $isRecovery   = false;

        // Evaluasi kondisi pengiriman:
        if ($currentLevel === 'BAHAYA') {
            if ($previousLevel !== 'BAHAYA') {
                // Transisi baru ke BAHAYA -> Kirim Langsung!
                $shouldNotify = true;
            } elseif (($currentTime - $lastSentTime) >= $this->dangerCooldownSeconds) {
                // Masih berstatus BAHAYA, namun telah melewati cooldown 60 detik -> Kirim Pengingat
                $shouldNotify = true;
            }
        } elseif ($currentLevel === 'WASPADA') {
            if ($previousLevel === 'AMAN') {
                // Transisi dari AMAN ke WASPADA -> Kirim Langsung!
                $shouldNotify = true;
            }
        } elseif ($currentLevel === 'AMAN') {
            if ($previousLevel === 'BAHAYA' || $previousLevel === 'WASPADA') {
                // Kondisi pulih dari darurat kembali ke normal -> Kirim Notifikasi Pemulihan!
                $shouldNotify = true;
                $isRecovery   = true;
            }
        }

        // Simpan status level terkini ke cache untuk perbandingan berikutnya
        Cache::put('telegram_last_alert_level', $currentLevel, now()->addHours(24));

        if (!$shouldNotify) {
            return false;
        }

        // Susun Pesan Markdown
        $message = $this->buildMarkdownMessage(
            $currentLevel,
            $temperature,
            $gasLevel,
            $fanStatus,
            $pumpStatus,
            $thresholds,
            $macAddress,
            $isRecovery
        );

        $sent = $this->sendRawMessage($message);

        // Catat ke tabel alert_logs
        AlertLog::create([
            'alert_level'      => $currentLevel,
            'message'          => $message,
            'temperature'      => $temperature,
            'gas_level'        => $gasLevel,
            'sent_to_telegram' => $sent,
        ]);

        if ($sent) {
            Cache::put('telegram_last_sent_timestamp', $currentTime, now()->addHours(24));
        }

        return $sent;
    }

    /**
     * Memformat teks notifikasi Telegram dengan Markdown rapi dan informatif.
     */
    protected function buildMarkdownMessage(
        string $level,
        float $temperature,
        float $gasLevel,
        bool $fanStatus,
        bool $pumpStatus,
        array $thresholds,
        ?string $macAddress,
        bool $isRecovery
    ): string {
        $timestamp = now()->timezone('Asia/Jakarta')->format('d M Y - H:i:s') . ' WIB';
        $tempTh    = $thresholds['temp_threshold'] ?? 45.0;
        $gasTh     = $thresholds['gas_threshold'] ?? 400.0;
        $mac       = $macAddress ?: 'ESP32-NODE-01';

        if ($isRecovery) {
            return "✅ *[SISTEM KEMBALI NORMAL]*\n\n"
                 . "Status: *AMAN (Kondisi Terkendali)*\n"
                 . "━━━━━━━━━━━━━━━━━━━━\n"
                 . "🌡️ *Suhu Ruangan:* " . number_format($temperature, 1) . " °C (Batas: {$tempTh} °C)\n"
                 . "💨 *Kadar Asap/Gas:* " . number_format($gasLevel, 0) . " PPM (Batas: {$gasTh} PPM)\n\n"
                 . "⚙️ *Status Aktuator:*\n"
                 . "• Kipas Exhaust : *" . ($fanStatus ? "ON" : "OFF") . "*\n"
                 . "• Pompa Air     : *" . ($pumpStatus ? "ON" : "OFF") . "*\n"
                 . "━━━━━━━━━━━━━━━━━━━━\n"
                 . "🕒 *Waktu:* {$timestamp}\n"
                 . "📍 *Node Sensor:* `{$mac}`\n"
                 . "ℹ️ _Semua indikator telah kembali berada di bawah batas kritis._";
        }

        if ($level === 'BAHAYA') {
            return "🚨 *[PERINGATAN DINI KEBAKARAN]* 🚨\n"
                 . "Status: *⚠️ BAHAYA / API TERDETEKSI ⚠️*\n"
                 . "━━━━━━━━━━━━━━━━━━━━\n"
                 . "‼️ *PERHATIAN:* Suhu tinggi dan asap pekat terdeteksi secara bersamaan!\n\n"
                 . "🌡️ *Suhu Ruangan:* *" . number_format($temperature, 1) . " °C* (Batas: {$tempTh} °C)\n"
                 . "💨 *Kadar Asap/Gas:* *" . number_format($gasLevel, 0) . " PPM* (Batas: {$gasTh} PPM)\n\n"
                 . "⚙️ *Respon Otomatis Aktuator:*\n"
                 . "• Kipas Exhaust : *ON (Pembuangan Asap)* 🟢\n"
                 . "• Pompa Air     : *ON (Pemadaman Aktif)* 🌊\n"
                 . "━━━━━━━━━━━━━━━━━━━━\n"
                 . "🕒 *Waktu Kejadian:* {$timestamp}\n"
                 . "📍 *ID Perangkat:* `{$mac}`\n"
                 . "⚠️ _Segera lakukan verifikasi fisik dan evakuasi jika diperlukan!_";
        }

        // WASPADA
        return "⚠️ *[PERINGATAN AWAL SENSOR]* ⚠️\n"
             . "Status: *WASPADA (ASAP / PANAS)*\n"
             . "━━━━━━━━━━━━━━━━━━━━\n"
             . "🌡️ *Suhu Ruangan:* " . number_format($temperature, 1) . " °C (Batas: {$tempTh} °C)\n"
             . "💨 *Kadar Asap/Gas:* *" . number_format($gasLevel, 0) . " PPM* (Batas: {$gasTh} PPM)\n\n"
             . "⚙️ *Status Aktuator:*\n"
             . "• Kipas Exhaust : *ON (Menyedot Asap)* 🟢\n"
             . "• Pompa Air     : *OFF (Siaga)* ⚪\n"
             . "━━━━━━━━━━━━━━━━━━━━\n"
             . "🕒 *Waktu:* {$timestamp}\n"
             . "📍 *Node Sensor:* `{$mac}`\n"
             . "ℹ️ _Kipas otomatis diaktifkan untuk membersihkan udara._";
    }

    /**
     * Mengirimkan payload teks ke Telegram Bot API via Laravel HTTP Client.
     */
    public function sendRawMessage(string $markdownText): bool
    {
        if (empty($this->botToken) || empty($this->chatId) || $this->botToken === 'YOUR_TELEGRAM_BOT_TOKEN') {
            Log::info("[TelegramService] Bot token atau Chat ID belum dikonfigurasi di .env. Pesan diabaikan.");
            return false;
        }

        $apiUrl = "https://api.telegram.org/bot{$this->botToken}/sendMessage";

        try {
            $response = Http::timeout(5)->post($apiUrl, [
                'chat_id'                  => $this->chatId,
                'text'                     => $markdownText,
                'parse_mode'               => 'Markdown',
                'disable_web_page_preview' => true,
            ]);

            if ($response->successful()) {
                Log::info("[TelegramService] Notifikasi berhasil terkirim ke Telegram.");
                return true;
            } else {
                Log::error("[TelegramService] Gagal mengirim pesan ke Telegram: " . $response->body());
                return false;
            }
        } catch (\Throwable $e) {
            Log::error("[TelegramService] Exception saat menghubungi Telegram API: " . $e->getMessage());
            return false;
        }
    }
}
