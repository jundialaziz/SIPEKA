<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'service'     => 'IoT Fire Early Warning System REST API',
        'version'     => '1.0.0',
        'framework'   => 'Laravel 11',
        'status'      => 'Operational',
        'api_doc'     => [
            'telemetry' => 'POST /api/iot/telemetry',
            'latest'    => 'GET /api/dashboard/latest',
            'history'   => 'GET /api/dashboard/history',
            'control'   => 'POST /api/dashboard/control',
        ],
        'timestamp'   => now()->toIso8601String(),
    ]);
});
