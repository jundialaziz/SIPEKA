<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\TelemetryController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes - SI PEKA (IoT Fire Early Warning System)
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    // Autentikasi Admin
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::prefix('iot')->group(function () {
    // Ingestion data telemetri dari ESP32
    Route::post('/telemetry', [TelemetryController::class, 'store']);
});

Route::prefix('dashboard')->group(function () {
    // Data status real-time & kontrol sistem untuk Dashboard Web
    Route::get('/latest', [DashboardController::class, 'latest']);
    Route::get('/history', [DashboardController::class, 'history']);
    Route::post('/control', [DashboardController::class, 'control']);
});
