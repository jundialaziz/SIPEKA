<?php

namespace App\Services;

use App\Models\DeviceControl;

class FireRuleEngineService
{
    /**
     * Mengevaluasi kondisi sensor terhadap ambang batas dan status kontrol aktuator.
     *
     * Aturan Logika:
     * 1. Status BAHAYA  : Suhu >= threshold DAN Gas >= threshold (Api terkonfirmasi).
     *    - Kipas: ON (Membuang asap pekat)
     *    - Pompa: ON (Pemadaman air darurat otomatis aktif)
     * 2. Status WASPADA : Suhu >= threshold ATAU Gas >= threshold.
     *    - Kipas: ON (Membuang asap/ventilasi)
     *    - Pompa: OFF (Mencegah air membanjiri ruangan jika baru indikasi asap rokok/panas ringan)
     * 3. Status AMAN    : Suhu < threshold DAN Gas < threshold.
     *    - Kipas: OFF
     *    - Pompa: OFF
     * 
     * Catatan: Jika auto_mode bernilai false (Manual Override), status relay mengikuti
     * instruksi manual user dari dashboard web.
     *
     * @param float $temperature
     * @param float $gasLevel
     * @param bool $gasDigital
     * @param DeviceControl|null $control
     * @return array
     */
    public function evaluate(float $temperature, float $gasLevel, bool $gasDigital = false, ?DeviceControl $control = null): array
    {
        $control = $control ?? DeviceControl::getActive();

        $tempThreshold = (float) $control->temp_threshold;
        $gasThreshold  = (float) $control->gas_threshold;

        $isHighTemp = ($temperature >= $tempThreshold);
        $isHighGas  = ($gasLevel >= $gasThreshold) || $gasDigital;

        // Tentukan Alert Level
        if ($isHighTemp && $isHighGas) {
            $alertLevel = 'BAHAYA';
            $reason = 'Kritis: Suhu tinggi dan kadar gas/asap pekat terdeteksi secara bersamaan (Potensi Api Aktif).';
        } elseif ($isHighTemp || $isHighGas) {
            $alertLevel = 'WASPADA';
            $reason = $isHighGas 
                ? 'Peringatan: Kadar gas/asap melebihi ambang batas aman.' 
                : 'Peringatan: Suhu ruangan melebihi ambang batas normal.';
        } else {
            $alertLevel = 'AMAN';
            $reason = 'Kondisi ruangan berada dalam batas parameter normal.';
        }

        // Tentukan Keputusan Aktuator
        if ($control->auto_mode) {
            // Mode Otomatis (Rule Engine)
            switch ($alertLevel) {
                case 'BAHAYA':
                    $fanState  = true; // Kipas menyala buang asap
                    $pumpState = true; // Pompa air aktif padamkan api
                    break;
                case 'WASPADA':
                    $fanState  = true;  // Kipas menyala buang asap
                    $pumpState = false; // Pompa tidak menyala
                    break;
                case 'AMAN':
                default:
                    $fanState  = false;
                    $pumpState = false;
                    break;
            }
        } else {
            // Mode Manual Override dari Dashboard
            $fanState  = (bool) $control->fan_override;
            $pumpState = (bool) $control->pump_override;
        }

        return [
            'alert_level' => $alertLevel,
            'fan'         => $fanState,
            'pump'        => $pumpState,
            'auto_mode'   => (bool) $control->auto_mode,
            'thresholds'  => [
                'temp_threshold' => $tempThreshold,
                'gas_threshold'  => $gasThreshold,
            ],
            'reason'      => $reason,
        ];
    }
}
