/**
 * ============================================================================
 * ALL-IN-ONE LOCAL SERVER & SIMULATION ENGINE (ZERO DEPENDENCY)
 * ============================================================================
 * Melayani dashboard frontend statis sekaligus menyediakan mock REST API
 * lengkap dan simulator sensor real-time.
 *
 * Jalankan:
 *   node server.js
 * Buka di browser:
 *   http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend-gh-pages');

// State Sistem Global
let control = {
    id: 1,
    auto_mode: true,
    fan_override: false,
    pump_override: false,
    temp_threshold: 45.0,
    gas_threshold: 400.0,
    updated_at: new Date().toISOString()
};

let reading = {
    id: 1,
    temperature: 28.4,
    gas_level: 160,
    gas_digital: false,
    fan_status: false,
    pump_status: false,
    alert_level: 'AMAN',
    mac_address: 'ESP32-DEV-SIMULATED',
    created_at: new Date().toISOString()
};

let history = [];
let recentAlerts = [
    {
        id: 1,
        alert_level: 'AMAN',
        message: 'Sistem pengawasan kebakaran aktif dan beroperasi normal.',
        temperature: 28.4,
        gas_level: 160,
        sent_to_telegram: true,
        created_at: new Date(Date.now() - 60000).toISOString()
    }
];

// Generator riwayat awal 25 titik
const now = Date.now();
for (let i = 25; i >= 0; i--) {
    history.push({
        id: 25 - i,
        temperature: parseFloat((27 + Math.random() * 2).toFixed(1)),
        gas_level: Math.floor(140 + Math.random() * 30),
        fan_status: false,
        pump_status: false,
        alert_level: 'AMAN',
        created_at: new Date(now - i * 3000).toISOString()
    });
}

// Simulasi Sensor Berkelanjutan (Setiap 2 Detik)
let tick = 0;
setInterval(() => {
    tick++;
    const cycle = tick % 30;

    let targetTemp = 28.0 + (Math.random() * 2);
    let targetGas = 150 + Math.floor(Math.random() * 30);

    if (cycle >= 8 && cycle <= 14) {
        // Fase Waspada (Asap Muncul)
        targetTemp = 32.5 + (Math.random() * 2.5);
        targetGas = 430 + Math.floor(Math.random() * 40);
    } else if (cycle >= 15 && cycle <= 22) {
        // Fase Bahaya (Api Membakar: Suhu Panas & Asap Pekat)
        targetTemp = 53.0 + (Math.random() * 5);
        targetGas = 620 + Math.floor(Math.random() * 90);
    }

    const isHighTemp = targetTemp >= control.temp_threshold;
    const isHighGas = targetGas >= control.gas_threshold;

    let alertLevel = 'AMAN';
    if (isHighTemp && isHighGas) {
        alertLevel = 'BAHAYA';
    } else if (isHighTemp || isHighGas) {
        alertLevel = 'WASPADA';
    }

    let fanState = false;
    let pumpState = false;

    if (control.auto_mode) {
        if (alertLevel === 'BAHAYA') {
            fanState = true;
            pumpState = true;
        } else if (alertLevel === 'WASPADA') {
            fanState = true;
            pumpState = false;
        } else {
            fanState = false;
            pumpState = false;
        }
    } else {
        fanState = control.fan_override;
        pumpState = control.pump_override;
    }

    const currentIso = new Date().toISOString();

    reading = {
        id: history.length + 1,
        temperature: parseFloat(targetTemp.toFixed(1)),
        gas_level: targetGas,
        gas_digital: isHighGas,
        fan_status: fanState,
        pump_status: pumpState,
        alert_level: alertLevel,
        mac_address: 'ESP32-DEV-SIMULATED',
        created_at: currentIso
    };

    history.push(reading);
    if (history.length > 50) history.shift();

    // Catat alert log jika status berubah
    const lastAlert = recentAlerts[0];
    if (!lastAlert || lastAlert.alert_level !== alertLevel) {
        recentAlerts.unshift({
            id: recentAlerts.length + 1,
            alert_level: alertLevel,
            message: alertLevel === 'BAHAYA' 
                ? 'KRITIS: Terdeteksi kobaran api! Suhu panas dan asap pekat terkonfirmasi.'
                : (alertLevel === 'WASPADA' ? 'Peringatan: Peningkatan gas/asap terdeteksi.' : 'Kondisi telah kembali normal dan terkendali.'),
            temperature: reading.temperature,
            gas_level: reading.gas_level,
            sent_to_telegram: true,
            created_at: currentIso
        });
        if (recentAlerts.length > 10) recentAlerts.pop();
    }
}, 2000);

// MIME Types
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // ==============================================================
    // API ENDPOINTS
    // ==============================================================

    // GET /api/dashboard/latest
    if (req.method === 'GET' && pathname === '/api/dashboard/latest') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            device_online: true,
            reading: reading,
            control: control,
            recent_alerts: recentAlerts,
            server_time: new Date().toISOString()
        }));
        return;
    }

    // GET /api/dashboard/history
    if (req.method === 'GET' && pathname === '/api/dashboard/history') {
        const limit = parseInt(url.searchParams.get('limit') || '30', 10);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            count: Math.min(limit, history.length),
            data: history.slice(-limit)
        }));
        return;
    }

    // POST /api/dashboard/control
    if (req.method === 'POST' && pathname === '/api/dashboard/control') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                if (data.auto_mode !== undefined) control.auto_mode = Boolean(data.auto_mode);
                if (data.fan_override !== undefined) control.fan_override = Boolean(data.fan_override);
                if (data.pump_override !== undefined) control.pump_override = Boolean(data.pump_override);
                if (data.temp_threshold !== undefined) control.temp_threshold = parseFloat(data.temp_threshold);
                if (data.gas_threshold !== undefined) control.gas_threshold = parseFloat(data.gas_threshold);
                control.updated_at = new Date().toISOString();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Konfigurasi kontrol berhasil diperbarui.',
                    control: control
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // POST /api/iot/telemetry
    if (req.method === 'POST' && pathname === '/api/iot/telemetry') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const temp = parseFloat(data.temperature) || reading.temperature;
                const gas = parseFloat(data.gas_level) || reading.gas_level;

                const isHighTemp = temp >= control.temp_threshold;
                const isHighGas = gas >= control.gas_threshold;

                let alertLevel = 'AMAN';
                if (isHighTemp && isHighGas) alertLevel = 'BAHAYA';
                else if (isHighTemp || isHighGas) alertLevel = 'WASPADA';

                let fan = false;
                let pump = false;

                if (control.auto_mode) {
                    fan = (alertLevel === 'BAHAYA' || alertLevel === 'WASPADA');
                    pump = (alertLevel === 'BAHAYA');
                } else {
                    fan = control.fan_override;
                    pump = control.pump_override;
                }

                reading = {
                    id: history.length + 1,
                    temperature: temp,
                    gas_level: gas,
                    gas_digital: Boolean(data.gas_digital),
                    fan_status: fan,
                    pump_status: pump,
                    alert_level: alertLevel,
                    mac_address: data.mac_address || 'ESP32-HARDWARE',
                    created_at: new Date().toISOString()
                };

                history.push(reading);
                if (history.length > 50) history.shift();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    reading_id: reading.id,
                    alert_level: alertLevel,
                    command: {
                        fan: fan,
                        pump: pump,
                        auto_mode: control.auto_mode
                    },
                    thresholds: {
                        temp_threshold: control.temp_threshold,
                        gas_threshold: control.gas_threshold
                    },
                    server_time: new Date().toISOString()
                }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: err.message }));
            }
        });
        return;
    }

    // ==============================================================
    // STATIC FILE SERVER (frontend-gh-pages)
    // ==============================================================
    let safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(FRONTEND_DIR, safePath);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n===============================================================`);
    console.log(`🚀 SI PEKA - IOT FIRE EARLY WARNING SYSTEM (LIVE SERVER RUNNING)`);
    console.log(`---------------------------------------------------------------`);
    console.log(`🌐 Dashboard URL : http://localhost:${PORT}`);
    console.log(`🌐 Local Network : http://127.0.0.1:${PORT}`);
    console.log(`📡 API Telemetry : http://localhost:${PORT}/api/iot/telemetry`);
    console.log(`📊 Dashboard API : http://localhost:${PORT}/api/dashboard/latest`);
    console.log(`===============================================================\n`);
});
