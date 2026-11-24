/**
 * ============================================================================
 * SISTEM PERINGATAN DINI KEBAKARAN IOT - FRONTEND CONFIGURATION
 * ============================================================================
 */

function getApiBaseUrl() {
    // Jika diakses melalui server web (localhost atau IP lokal port 3000 / 8000)
    if (window.location.protocol.startsWith('http')) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `${window.location.origin}/api`;
        }
        // Jika di GitHub Pages, gunakan URL backend publik Anda
        return 'https://iot-fire-alarm.up.railway.app/api';
    }

    // Jika dibuka langsung via file:/// di browser
    return 'http://127.0.0.1:3000/api';
}

const CONFIG = {
    API_BASE_URL: getApiBaseUrl(),
    POLL_INTERVAL_MS: 2000,
    CHART_MAX_POINTS: 30,
    ROOM_NAME: 'Ruang Server & Laboratorium IoT'
};

window.CONFIG = CONFIG;
