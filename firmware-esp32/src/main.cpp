/**
 * ============================================================================
 * SISTEM PERINGATAN DINI KEBAKARAN BERBASIS IOT - ESP32 MAIN FIRMWARE
 * ============================================================================
 * Mikrokontroler: ESP32 Dev Module / NodeMCU-32S
 * Framework     : Arduino / PlatformIO
 * Sensor        : LM35 (Suhu), MQ-2 (Gas/Asap)
 * Aktuator      : Relay Module 2-Channel Active LOW (Kipas & Pompa Air)
 * Komunikasi    : Wi-Fi HTTP POST (JSON Payload) ke Laravel REST API
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

// ============================================================================
// VARIABEL GLOBAL STATUS SISTEM
// ============================================================================
float g_temperatureC     = 0.0f;
float g_gasLevel         = 0.0f;
bool  g_gasDigitalAlert  = false;

bool  g_fanState         = false;   // false = OFF, true = ON
bool  g_pumpState        = false;   // false = OFF, true = ON
bool  g_buzzerState      = false;

String g_alertLevel      = "AMAN";  // "AMAN", "WASPADA", "BAHAYA"
bool   g_autoMode        = true;

// Ambang batas lokal (dapat disinkronisasi dari respon server)
float g_tempThreshold    = LOCAL_TEMP_THRESHOLD_DANGER;
float g_gasThreshold     = LOCAL_GAS_THRESHOLD_DANGER;

// Tracking waktu & status komunikasi
unsigned long g_lastTelemetryTime = 0;
int  g_consecutiveHttpFailures    = 0;
bool g_isServerOnline             = false;
String g_macAddress               = "";

// ============================================================================
// PROTOTYPE FUNGSI
// ============================================================================
void initHardware();
void connectWiFi();
void checkWiFiConnection();
float readLM35Temperature();
float readMQ2GasLevel();
void applyActuators(bool fanOn, bool pumpOn, bool buzzerOn);
void sendTelemetryToBackend();
void runLocalFailSafeLogic();
void printSystemStatus();

// ============================================================================
// SETUP
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n=======================================================");
    Serial.println("   SI PEKA - SISTEM PERINGATAN DINI KEBAKARAN IOT     ");
    Serial.println("=======================================================");

    // Inisialisasi Hardware I/O & Relay
    initHardware();

    // Dapatkan MAC Address ESP32 untuk ID unik perangkat
    WiFi.mode(WIFI_STA);
    g_macAddress = WiFi.macAddress();
    Serial.printf("[SYSTEM] ESP32 MAC Address: %s\n", g_macAddress.c_str());

    // Hubungkan ke Wi-Fi
    connectWiFi();

    Serial.println("[SYSTEM] Sistem Siap Beroperasi. Memulai Siklus Pengawasan...");
    Serial.println("-------------------------------------------------------");
}

// ============================================================================
// LOOP UTAMA
// ============================================================================
void loop() {
    // 1. Pastikan Wi-Fi tetap terhubung (reconnect otomatis jika terputus)
    checkWiFiConnection();

    // 2. Baca nilai sensor terbaru secara berkala
    g_temperatureC    = readLM35Temperature();
    g_gasLevel        = readMQ2GasLevel();
    g_gasDigitalAlert = (digitalRead(PIN_MQ2_DIGITAL) == LOW); // MQ-2 active low digital trigger

    // 3. Siklus Pengiriman Telemetri ke Backend Laravel
    unsigned long currentMillis = millis();
    if (currentMillis - g_lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        g_lastTelemetryTime = currentMillis;

        if (WiFi.status() == WL_CONNECTED) {
            sendTelemetryToBackend();
        } else {
            g_consecutiveHttpFailures++;
            Serial.println("[WARN] Wi-Fi terputus! Beralih ke pengawasan mandiri.");
        }

        // 4. Fail-Safe: Jika backend offline beberapa kali, aktifkan logika mandiri lokal
        if (g_consecutiveHttpFailures >= MAX_CONSECUTIVE_HTTP_FAILURES) {
            if (g_isServerOnline) {
                Serial.println("[FAILSAFE] Backend tidak merespon. Menjalankan Autonomous Fail-Safe!");
                g_isServerOnline = false;
            }
            runLocalFailSafeLogic();
        }

        // 5. Cetak Telemetri ke Serial Monitor
        printSystemStatus();
    }

    // Delay kecil untuk stabilitas task RTOS
    delay(20);
}

// ============================================================================
// INISIALISASI PIN & HARDWARE
// ============================================================================
void initHardware() {
    // PENTING: Untuk modul relay Active-LOW, tulis HIGH terlebih dahulu
    // SEBELUM mengubah pinMode menjadi OUTPUT untuk mencegah "glitch" atau
    // relay sempat menyala sesaat saat ESP32 pertama kali boot/reset.
    digitalWrite(PIN_RELAY_FAN, RELAY_INACTIVE_LEVEL);
    digitalWrite(PIN_RELAY_PUMP, RELAY_INACTIVE_LEVEL);
    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_LED_STATUS, LOW);

    pinMode(PIN_RELAY_FAN, OUTPUT);
    pinMode(PIN_RELAY_PUMP, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    pinMode(PIN_LED_STATUS, OUTPUT);

    pinMode(PIN_MQ2_DIGITAL, INPUT_PULLUP);

    // Konfigurasi ADC ESP32:
    // Resolusi 12-bit (nilai 0 - 4095)
    // Redaman ADC 11dB (rentang tegangan input hingga ~3.1V / 3.3V)
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);

    Serial.println("[HARDWARE] Pin I/O dan Relay berhasil diinisialisasi (Relay Status: OFF).");
}

// ============================================================================
// KONEKSI WI-FI DENGAN AUTO RECONNECT
// ============================================================================
void connectWiFi() {
    Serial.printf("[WIFI] Menghubungkan ke SSID: %s ", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS));
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(PIN_LED_STATUS, HIGH);
        Serial.println("\n[WIFI] Berhasil Terhubung!");
        Serial.printf("[WIFI] IP Address ESP32: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("[WIFI] Signal Strength (RSSI): %d dBm\n", WiFi.RSSI());
    } else {
        digitalWrite(PIN_LED_STATUS, LOW);
        Serial.println("\n[WIFI] Gagal terhubung ke Wi-Fi! ESP32 akan tetap memantau secara offline.");
    }
}

void checkWiFiConnection() {
    if (WiFi.status() != WL_CONNECTED) {
        static unsigned long lastReconnectAttempt = 0;
        if (millis() - lastReconnectAttempt > 10000) {
            lastReconnectAttempt = millis();
            Serial.println("[WIFI] Mencoba menyambungkan kembali ke Wi-Fi...");
            WiFi.disconnect();
            WiFi.reconnect();
        }
    }
}

// ============================================================================
// PEMBACAAN & KALIBRASI SENSOR SUHU LM35
// ============================================================================
/**
 * LM35 Linear Temperature Sensor:
 * - Output: 10 mV / °C (Misal: 250 mV = 25.0 °C)
 * - ESP32 ADC: Menggunakan fungsi bawaan `analogReadMilliVolts()` yang
 *   secara otomatis membaca tabel kalibrasi internal eFuse chip ESP32,
 *   sehingga menghasilkan nilai milivolt yang jauh lebih akurat dibanding pembacaan mentah 12-bit.
 * - Multi-sampling dilakukan sebanyak ADC_SAMPLE_COUNT untuk meredam noise.
 */
float readLM35Temperature() {
    uint32_t totalMilliVolts = 0;

    for (int i = 0; i < ADC_SAMPLE_COUNT; i++) {
        totalMilliVolts += analogReadMilliVolts(PIN_LM35);
        delayMicroseconds(500);
    }

    float avgMilliVolts = (float)totalMilliVolts / (float)ADC_SAMPLE_COUNT;
    float tempC = (avgMilliVolts / LM35_MV_PER_DEGREE) + TEMP_OFFSET_CALIBRATION;

    // Filter batas wajar (noise filter)
    if (tempC < 0.0f) tempC = 0.0f;
    if (tempC > 150.0f) tempC = 150.0f;

    return tempC;
}

// ============================================================================
// PEMBACAAN SENSOR GAS & ASAP MQ-2
// ============================================================================
/**
 * MQ-2 Gas Sensor:
 * - Mendeteksi Asap, LPG, Propana, Metana, Butana, dan Hidrogen.
 * - Multi-sampling 20 sampel analog untuk stabilitas pembacaan.
 * - Menghasilkan representasi analog level (0 - 4095) yang proporsional
 *   dengan densitas gas/asap yang terdeteksi.
 */
float readMQ2GasLevel() {
    uint32_t totalRaw = 0;

    for (int i = 0; i < ADC_SAMPLE_COUNT; i++) {
        totalRaw += analogRead(PIN_MQ2_ANALOG);
        delayMicroseconds(500);
    }

    float avgRaw = (float)totalRaw / (float)ADC_SAMPLE_COUNT;
    return avgRaw;
}

// ============================================================================
// KONTROL AKTUATOR RELAY (ACTIVE LOW) & BUZZER
// ============================================================================
void applyActuators(bool fanOn, bool pumpOn, bool buzzerOn) {
    g_fanState    = fanOn;
    g_pumpState   = pumpOn;
    g_buzzerState = buzzerOn;

    // Tulis ke pin Relay (Active LOW)
    digitalWrite(PIN_RELAY_FAN,  fanOn  ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
    digitalWrite(PIN_RELAY_PUMP, pumpOn ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);

    // Tulis ke Buzzer (Active HIGH)
    digitalWrite(PIN_BUZZER, buzzerOn ? HIGH : LOW);
}

// ============================================================================
// PENGIRIMAN TELEMETRI & PENERIMAAN INSTRUKSI KONTROL (REST API)
// ============================================================================
void sendTelemetryToBackend() {
    HTTPClient http;
    http.begin(BACKEND_TELEMETRY_URL);
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Accept", "application/json");

    // Siapkan Payload JSON menggunakan ArduinoJson v7
    JsonDocument docOut;
    docOut["temperature"] = serialized(String(g_temperatureC, 2));
    docOut["gas_level"]   = (int)g_gasLevel;
    docOut["gas_digital"] = g_gasDigitalAlert;
    docOut["fan_status"]  = g_fanState;
    docOut["pump_status"] = g_pumpState;
    docOut["mac_address"] = g_macAddress;

    String jsonRequestBody;
    serializeJson(docOut, jsonRequestBody);

    // Kirim HTTP POST Request
    int httpResponseCode = http.POST(jsonRequestBody);

    if (httpResponseCode == HTTP_CODE_OK || httpResponseCode == HTTP_CODE_CREATED) {
        String responsePayload = http.getString();
        g_consecutiveHttpFailures = 0;
        g_isServerOnline = true;

        // Parsing respon JSON dari backend
        JsonDocument docIn;
        DeserializationError error = deserializeJson(docIn, responsePayload);

        if (!error) {
            // Ambil status alert level yang ditentukan oleh backend rule engine
            if (docIn.containsKey("alert_level")) {
                g_alertLevel = docIn["alert_level"].as<String>();
            }

            // Ambil instruksi kontrol aktuator dari server
            bool fanCommand  = g_fanState;
            bool pumpCommand = g_pumpState;
            bool buzzerAlert = (g_alertLevel == "BAHAYA");

            if (docIn.containsKey("command")) {
                JsonObject cmd = docIn["command"];
                if (cmd.containsKey("fan")) fanCommand = cmd["fan"].as<bool>();
                if (cmd.containsKey("pump")) pumpCommand = cmd["pump"].as<bool>();
                if (cmd.containsKey("auto_mode")) g_autoMode = cmd["auto_mode"].as<bool>();
            }

            // Update threshold terkini jika dikirim oleh server
            if (docIn.containsKey("thresholds")) {
                JsonObject th = docIn["thresholds"];
                if (th.containsKey("temp_threshold")) g_tempThreshold = th["temp_threshold"].as<float>();
                if (th.containsKey("gas_threshold")) g_gasThreshold = th["gas_threshold"].as<float>();
            }

            // Terapkan hasil keputusan ke Relay fisik
            applyActuators(fanCommand, pumpCommand, buzzerAlert);
        } else {
            Serial.printf("[HTTP] JSON Deserialization error: %s\n", error.c_str());
        }
    } else {
        g_consecutiveHttpFailures++;
        Serial.printf("[HTTP] POST Gagal, Error Code: %d (%s)\n", 
                      httpResponseCode, http.errorToString(httpResponseCode).c_str());
    }

    http.end();
}

// ============================================================================
// LOCAL AUTONOMOUS FAIL-SAFE LOGIC
// ============================================================================
/**
 * Dijalankan otomatis jika backend tidak merespons selama beberapa siklus.
 * Menjamin bahwa jika kebakaran terjadi saat jaringan terputus,
 * ESP32 tetap menyelamatkan ruangan secara otonom!
 */
void runLocalFailSafeLogic() {
    bool fanTrigger  = false;
    bool pumpTrigger = false;
    bool buzzerTrigger = false;

    bool isHighGas  = (g_gasLevel >= g_gasThreshold) || g_gasDigitalAlert;
    bool isHighTemp = (g_temperatureC >= g_tempThreshold);

    if (isHighTemp && isHighGas) {
        // Status BAHAYA (Api terdeteksi): Nyalakan Kipas & Pompa Air & Buzzer
        g_alertLevel = "BAHAYA";
        fanTrigger   = true;
        pumpTrigger  = true;
        buzzerTrigger = true;
    } else if (isHighGas || isHighTemp) {
        // Status WASPADA: Nyalakan Kipas untuk buang asap
        g_alertLevel = "WASPADA";
        fanTrigger   = true;
        pumpTrigger  = false;
        buzzerTrigger = false;
    } else {
        // Status AMAN
        g_alertLevel = "AMAN";
        fanTrigger   = false;
        pumpTrigger  = false;
        buzzerTrigger = false;
    }

    // Terapkan langsung ke hardware
    applyActuators(fanTrigger, pumpTrigger, buzzerTrigger);
}

// ============================================================================
// SERIAL DEBUGGING OUTPUT
// ============================================================================
void printSystemStatus() {
    Serial.printf("[TELEMETRI] Suhu: %5.1f°C | Gas: %4.0f | Status: %-7s | Fan: %-3s | Pump: %-3s | Mode: %-6s | Server: %s\n",
                  g_temperatureC,
                  g_gasLevel,
                  g_alertLevel.c_str(),
                  g_fanState ? "ON" : "OFF",
                  g_pumpState ? "ON" : "OFF",
                  g_autoMode ? "AUTO" : "MANUAL",
                  g_isServerOnline ? "ONLINE" : "OFFLINE"
    );
}
