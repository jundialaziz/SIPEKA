<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertLog;
use App\Models\DeviceControl;
use App\Models\SensorReading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DashboardController extends Controller
{
    /**
     * Mengambil data telemetri real-time terbaru dan konfigurasi kontrol.
     * Endpoint: GET /api/dashboard/latest
     */
    public function latest(): JsonResponse
    {
        $latestReading = SensorReading::latest('id')->first();
        $control = DeviceControl::getActive();
        $recentAlerts = AlertLog::latest('id')->take(8)->get();

        // Hitung status online ESP32 (jika mengirim data dalam 10 detik terakhir)
        $isDeviceOnline = false;
        if ($latestReading && $latestReading->created_at) {
            $isDeviceOnline = $latestReading->created_at->diffInSeconds(now()) <= 10;
        }

        return response()->json([
            'status'         => 'success',
            'device_online'  => $isDeviceOnline,
            'reading'        => $latestReading,
            'control'        => $control,
            'recent_alerts'  => $recentAlerts,
            'server_time'    => now()->toIso8601String(),
        ]);
    }

    /**
     * Mengambil data historis pembacaan sensor untuk visualisasi grafik (Chart.js).
     * Endpoint: GET /api/dashboard/history?limit=50
     */
    public function history(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', 50);
        $limit = max(10, min(150, $limit));

        // Ambil data terbaru, lalu urutkan ASC untuk render grafik garis kronologis
        $readings = SensorReading::select([
            'id',
            'temperature',
            'gas_level',
            'fan_status',
            'pump_status',
            'alert_level',
            'created_at'
        ])
        ->latest('id')
        ->take($limit)
        ->get()
        ->reverse()
        ->values();

        return response()->json([
            'status' => 'success',
            'count'  => $readings->count(),
            'data'   => $readings,
        ]);
    }

    /**
     * Memperbarui konfigurasi sistem: Mode Auto/Manual, Manual Override Aktuator, dan Ambang Batas.
     * Endpoint: POST /api/dashboard/control
     */
    public function control(Request $request): JsonResponse
    {
        // Verifikasi hak akses Administrator
        $authHeader = $request->header('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Akses ditolak! Anda harus login sebagai Admin untuk mengubah pengaturan atau mengontrol aktuator.',
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'auto_mode'      => 'nullable|boolean',
            'fan_override'   => 'nullable|boolean',
            'pump_override'  => 'nullable|boolean',
            'temp_threshold' => 'nullable|numeric|min:20|max:120',
            'gas_threshold'  => 'nullable|numeric|min:50|max:4095',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Input konfigurasi kontrol tidak valid.',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $control = DeviceControl::getActive();

        if ($request->has('auto_mode')) {
            $control->auto_mode = (bool) $request->input('auto_mode');
        }
        if ($request->has('fan_override')) {
            $control->fan_override = (bool) $request->input('fan_override');
        }
        if ($request->has('pump_override')) {
            $control->pump_override = (bool) $request->input('pump_override');
        }
        if ($request->has('temp_threshold')) {
            $control->temp_threshold = (float) $request->input('temp_threshold');
        }
        if ($request->has('gas_threshold')) {
            $control->gas_threshold = (float) $request->input('gas_threshold');
        }

        $control->save();

        return response()->json([
            'status'  => 'success',
            'message' => 'Konfigurasi kontrol berhasil diperbarui.',
            'control' => $control,
        ]);
    }
}
