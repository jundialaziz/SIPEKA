/**
 * ============================================================================
 * ESP32 HARDWARE TELEMETRY SIMULATOR
 * ============================================================================
 * Skrip pengujian untuk mensimulasikan pengiriman data telemetri dari ESP32
 * ke REST API Laravel tanpa harus menyambungkan hardware fisik terlebih dahulu.
 *
 * Cara Menjalankan:
 *   node firmware-esp32/simulate_esp32.js
 */

const API_ENDPOINT = process.env.API_URL || 'http://127.0.0.1:8000/api/iot/telemetry';

console.log('===============================================================');
console.log('   SIMULATOR TELEMETRI ESP32 - IOT FIRE EARLY WARNING SYSTEM   ');
console.log(`   Target Server: ${API_ENDPOINT}`);
console.log('===============================================================\n');

let cycle = 0;
let simulatedFan = false;
let simulatedPump = false;

// Skenario pengujian berkelanjutan (Aman -> Waspada Asap -> Bahaya Kebakaran -> Pemulihan)
async function sendTelemetryTick() {
    cycle++;

    let temperature = 27.5 + (Math.random() * 2);
    let gasLevel = 140 + Math.floor(Math.random() * 30);
    let scenarioLabel = 'Kondisi Normal (AMAN)';

    // Siklus pengujian:
    // Detik 0 - 15  : Kondisi AMAN
    // Detik 16 - 28 : Kondisi WASPADA (Asap naik)
    // Detik 29 - 45 : Kondisi BAHAYA (Suhu & Asap tinggi bersamaan)
    // Detik 46+     : Pemulihan kembali ke normal
    const mod = cycle % 25;

    if (mod >= 7 && mod <= 12) {
        // Fase Waspada
        temperature = 31.0 + (Math.random() * 2);
        gasLevel = 420 + Math.floor(Math.random() * 40);
        scenarioLabel = 'Terdeteksi Asap (WASPADA)';
    } else if (mod >= 13 && mod <= 19) {
        // Fase Bahaya Kebakaran
        temperature = 53.0 + (Math.random() * 4);
        gasLevel = 620 + Math.floor(Math.random() * 80);
        scenarioLabel = 'KEBAKARAN AKTIF (BAHAYA)';
    }

    const payload = {
        temperature: parseFloat(temperature.toFixed(2)),
        gas_level: gasLevel,
        gas_digital: gasLevel >= 400,
        fan_status: simulatedFan,
        pump_status: simulatedPump,
        mac_address: 'ESP32-SIMULATED-DEV'
    };

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            simulatedFan = data.command?.fan || false;
            simulatedPump = data.command?.pump || false;

            console.log(`[Siklus #${String(cycle).padStart(3, '0')}] [${scenarioLabel}]`);
            console.log(`  Sensor  : Suhu = ${payload.temperature}°C | Gas = ${payload.gas_level} PPM`);
            console.log(`  Respon  : Alert Level = ${data.alert_level}`);
            console.log(`  Aktuator: Kipas = ${simulatedFan ? '🟢 ON' : '⚪ OFF'} | Pompa = ${simulatedPump ? '🌊 ON' : '⚪ OFF'}`);
            console.log('---------------------------------------------------------------');
        } else {
            console.error(`[Siklus #${cycle}] HTTP Error: ${response.status} ${response.statusText}`);
        }
    } catch (err) {
        console.error(`[Siklus #${cycle}] Koneksi gagal ke ${API_ENDPOINT}:`, err.message);
        console.log('  -> Pastikan server Laravel sedang berjalan (php artisan serve).');
    }
}

// Kirim setiap 2.5 detik (sesuai interval firmware fisik)
setInterval(sendTelemetryTick, 2500);
sendTelemetryTick();
