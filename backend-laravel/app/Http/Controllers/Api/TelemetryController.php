<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceControl;
use App\Models\SensorReading;
use App\Services\FireRuleEngineService;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TelemetryController extends Controller
{
    protected FireRuleEngineService $ruleEngine;
    protected TelegramService $telegramService;

    public function __construct(FireRuleEngineService $ruleEngine, TelegramService $telegramService)
    {
        $this->ruleEngine = $ruleEngine;
        $this->telegramService = $telegramService;
    }

    /**
     * Menerima telemetri sensor dari mikrokontroler ESP32 via HTTP POST.
     * Endpoint: POST /api/iot/telemetry
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'temperature' => 'required|numeric',
            'gas_level'   => 'required|numeric',
            'gas_digital' => 'nullable|boolean',
            'fan_status'  => 'nullable|boolean',
            'pump_status' => 'nullable|boolean',
            'mac_address' => 'nullable|string|max:32',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Validasi data sensor gagal.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $temperature = (float) $validated['temperature'];
        $gasLevel    = (float) $validated['gas_level'];
        $gasDigital  = (bool) ($validated['gas_digital'] ?? false);
        $macAddress  = $validated['mac_address'] ?? null;

        // Ambil konfigurasi kontrol & ambang batas terkini
        $control = DeviceControl::getActive();

        // Evaluasi logika keselamatan kebakaran
        $decision = $this->ruleEngine->evaluate($temperature, $gasLevel, $gasDigital, $control);

        $alertLevel = $decision['alert_level'];
        $fanCommand = $decision['fan'];
        $pumpCommand= $decision['pump'];

        // Simpan data telemetri ke Database
        $reading = SensorReading::create([
            'temperature' => $temperature,
            'gas_level'   => $gasLevel,
            'gas_digital' => $gasDigital,
            'fan_status'  => $fanCommand,
            'pump_status' => $pumpCommand,
            'alert_level' => $alertLevel,
            'mac_address' => $macAddress,
        ]);

        // Evaluasi dan kirim notifikasi Telegram (dengan sistem Anti-Spam / Cooldown)
        $this->telegramService->handleAlertNotification(
            $alertLevel,
            $temperature,
            $gasLevel,
            $fanCommand,
            $pumpCommand,
            $decision['thresholds'],
            $macAddress
        );

        // Berikan feedback JSON instruksi aktuator kembali ke ESP32
        return response()->json([
            'status'      => 'success',
            'reading_id'  => $reading->id,
            'alert_level' => $alertLevel,
            'command'     => [
                'fan'       => $fanCommand,
                'pump'      => $pumpCommand,
                'auto_mode' => $decision['auto_mode'],
            ],
            'thresholds'  => $decision['thresholds'],
            'server_time' => now()->toDateTimeString(),
        ], 200);
    }
}
