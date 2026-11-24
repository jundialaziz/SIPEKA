/**
 * ============================================================================
 * SISTEM PERINGATAN DINI KEBAKARAN BERBASIS IOT - ESP32 FIRMWARE CONFIGURATION
 * ============================================================================
 * File: config.h
 * Deskripsi: Konfigurasi Pinout, Jaringan Wi-Fi, Server REST API, dan Ambang Batas
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ============================================================================
// 1. KONFIGURASI WI-FI & BACKEND REST API
// ============================================================================
// Ganti dengan SSID dan Password Wi-Fi Anda
#define WIFI_SSID           "WIFI_SSID_ANDA"
#define WIFI_PASSWORD       "WIFI_PASSWORD_ANDA"

// URL endpoint API Telemetri Laravel Backend
// Jika diuji di jaringan lokal yang sama, gunakan IP lokal laptop/server (misal: 192.168.1.100)
// Jika menggunakan Tunnel (seperti Ngrok, Cloudflare Tunnel), gunakan URL HTTPS tunnel tersebut.
#define BACKEND_TELEMETRY_URL "http://192.168.1.100:8000/api/iot/telemetry"

// Timeout request HTTP dalam milidetik
#define HTTP_TIMEOUT_MS     4000

// Interval pengiriman data telemetri ke server (milidetik) -> Setiap 2.5 detik
#define TELEMETRY_INTERVAL_MS 2500

// ============================================================================
// 2. PINOUT HARDWARE (GPIO MAPPING)
// ============================================================================
// SENSOR SUHU LM35
// Gunakan ADC1 (GPIO 32 - 39) karena ADC1 aman digunakan bersamaan dengan Wi-Fi aktif.
// (PENTING: ADC2 ESP32 tidak bisa membaca analog saat Wi-Fi menyala).
#define PIN_LM35            34  // ADC1 Channel 6 (Input Analog Sensor Suhu)

// SENSOR GAS & ASAP MQ-2
#define PIN_MQ2_ANALOG      35  // ADC1 Channel 7 (Input Analog Asap/Gas)
#define PIN_MQ2_DIGITAL     32  // Input Digital (Active LOW jika asap melewati potensiometer modul)

// AKTUATOR RELAY MODULE 2-CHANNEL
// Modul Relay 2-Channel umumnya beroperasi pada logika ACTIVE LOW:
// - LOW  (0V)   = Relay ON (Kontak NO terhubung -> Beban Menyala)
// - HIGH (3.3V) = Relay OFF (Kontak NO terbuka  -> Beban Mati)
#define PIN_RELAY_FAN       26  // Relay Channel 1: Kipas Exhaust Fan
#define PIN_RELAY_PUMP      27  // Relay Channel 2: Pompa Air Mini (Solenoid / Water Pump)

// INDIKATOR LED & BUZZER
#define PIN_BUZZER          25  // Buzzer Alarm Lokal (Aktif saat status BAHAYA)
#define PIN_LED_STATUS      2   // Built-in LED ESP32 (Indikator status koneksi/aktivitas)

// ============================================================================
// 3. LOGIKA KONTROL RELAY (ACTIVE LOW)
// ============================================================================
#define RELAY_ACTIVE_LEVEL   LOW   // Tingkat logika untuk menyalakan relay
#define RELAY_INACTIVE_LEVEL HIGH  // Tingkat logika untuk mematikan relay

// ============================================================================
// 4. PARAMETER KALIBRASI SENSOR
// ============================================================================
// Jumlah sampel untuk rata-rata pembacaan ADC (mengurangi noise analog)
#define ADC_SAMPLE_COUNT    20

// LM35 mengeluarkan 10.0 mV per 1.0 derajat Celcius
// Formula: Suhu (°C) = Tegangan (mV) / 10.0
#define LM35_MV_PER_DEGREE  10.0f

// Faktor kalibrasi tambahan (offset) jika sensor LM35 mengalami bias suhu (default 0.0)
#define TEMP_OFFSET_CALIBRATION 0.0f

// ============================================================================
// 5. LOCAL FAIL-SAFE THRESHOLDS (STANDALONE SAFETY MODE)
// ============================================================================
// Jika koneksi Wi-Fi atau Server Backend terputus, ESP32 tetap mampu melakukan
// mitigasi mandiri menggunakan ambang batas lokal berikut demi keamanan aset!
#define LOCAL_TEMP_THRESHOLD_DANGER 50.0f   // Batas kritis Suhu Api (°C)
#define LOCAL_GAS_THRESHOLD_WARN    350.0f  // Batas Waspada Asap (PPM / Analog Level)
#define LOCAL_GAS_THRESHOLD_DANGER  500.0f  // Batas Kritis Asap Pekat (PPM / Analog Level)

// Toleransi kegagalan HTTP sebelum beralih ke Local Autonomous Mode (hitungan siklus)
#define MAX_CONSECUTIVE_HTTP_FAILURES 3

#endif // CONFIG_H
