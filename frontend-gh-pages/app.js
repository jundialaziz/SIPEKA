/**
 * ============================================================================
 * SI PEKA - SISTEM PERINGATAN DINI KEBAKARAN IOT - DASHBOARD FRONTEND LOGIC (ALPINE.JS)
 * ============================================================================
 */

function fireDashboard() {
    return {
        // Status Jaringan
        isServerConnected: false,
        isDeviceOnline: false,
        lastUpdatedTime: '-',
        pollingTimer: null,

        // Data Telemetri Terkini
        reading: {
            temperature: 0.0,
            gas_level: 0,
            fan_status: false,
            pump_status: false,
            alert_level: 'AMAN',
            created_at: null,
            mac_address: '-'
        },

        // Konfigurasi Kontrol & Ambang Batas
        control: {
            auto_mode: true,
            fan_override: false,
            pump_override: false,
            temp_threshold: 45.0,
            gas_threshold: 400.0
        },

        // Form Input Ambang Batas
        thresholdForm: {
            temp_threshold: 45.0,
            gas_threshold: 400.0
        },

        // Log Peringatan Terkini
        recentAlerts: [],

        // Status Audio Sirine
        isSirenPlaying: false,
        isMuted: false,
        isAudioUnlocked: false,

        // Status Tombol Loading
        isUpdatingControl: false,
        isSavingThreshold: false,

        // Toast Feedback
        toast: {
            show: false,
            message: '',
            type: 'info'
        },

        // Instance Chart.js
        chartInstance: null,

        /**
         * Inisialisasi awal saat Alpine.js terpasang di DOM
         */
        async init() {
            console.log('[Dashboard] Memulai Dashboard SI PEKA (IoT Fire Alarm)...');

            // Inisialisasi Chart.js
            this.initChart();

            // Ambil data riwayat untuk mengisi grafik awal
            await this.fetchHistory();

            // Ambil data status real-time pertama kali
            await this.fetchLatest();

            // Mulai polling berkala sesuai interval konfigurasi (2 detik)
            const interval = (window.CONFIG && window.CONFIG.POLL_INTERVAL_MS) || 2000;
            this.pollingTimer = setInterval(() => {
                this.fetchLatest();
            }, interval);

            // Buka izin audio pada klik pertama di window
            const unlockHandler = () => {
                this.unlockAudio();
                window.removeEventListener('click', unlockHandler);
            };
            window.addEventListener('click', unlockHandler);
        },

        /**
         * Mengambil data status telemetri real-time terbaru dari Backend
         */
        async fetchLatest() {
            const baseUrl = (window.CONFIG && window.CONFIG.API_BASE_URL) || 'http://127.0.0.1:8000/api';

            try {
                const response = await fetch(`${baseUrl}/dashboard/latest`, {
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error(`Server returned HTTP ${response.status}`);
                }

                const json = await response.json();

                if (json.status === 'success') {
                    this.isServerConnected = true;
                    this.isDeviceOnline = json.device_online;
                    this.lastUpdatedTime = new Date().toLocaleTimeString('id-ID');

                    // Update data sensor
                    if (json.reading) {
                        this.reading = {
                            temperature: parseFloat(json.reading.temperature) || 0.0,
                            gas_level: parseFloat(json.reading.gas_level) || 0,
                            fan_status: Boolean(json.reading.fan_status),
                            pump_status: Boolean(json.reading.pump_status),
                            alert_level: json.reading.alert_level || 'AMAN',
                            created_at: json.reading.created_at,
                            mac_address: json.reading.mac_address || 'ESP32-NODE-01'
                        };

                        // Masukkan titik data terbaru ke grafik
                        this.pushChartData(this.reading.temperature, this.reading.gas_level, new Date());
                    }

                    // Update status kontrol & threshold
                    if (json.control) {
                        this.control = {
                            auto_mode: Boolean(json.control.auto_mode),
                            fan_override: Boolean(json.control.fan_override),
                            pump_override: Boolean(json.control.pump_override),
                            temp_threshold: parseFloat(json.control.temp_threshold) || 45.0,
                            gas_threshold: parseFloat(json.control.gas_threshold) || 400.0
                        };

                        // Sinkronkan ke form jika form belum pernah diubah user
                        if (!this.isSavingThreshold) {
                            this.thresholdForm.temp_threshold = this.control.temp_threshold;
                            this.thresholdForm.gas_threshold = this.control.gas_threshold;
                        }
                    }

                    // Update daftar alert logs
                    if (json.recent_alerts) {
                        this.recentAlerts = json.recent_alerts;
                    }

                    // Evaluasi bunyi audio sirine alarm
                    this.handleAlarmAudio();
                }
            } catch (error) {
                console.warn('[Dashboard] Gagal terhubung ke API backend:', error.message);
                this.isServerConnected = false;
                this.isDeviceOnline = false;
            }
        },

        /**
         * Mengambil riwayat telemetri untuk grafik garis
         */
        async fetchHistory() {
            const baseUrl = (window.CONFIG && window.CONFIG.API_BASE_URL) || 'http://127.0.0.1:8000/api';

            try {
                const response = await fetch(`${baseUrl}/dashboard/history?limit=25`, {
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    const json = await response.json();
                    if (json.status === 'success' && Array.isArray(json.data)) {
                        this.populateChart(json.data);
                    }
                }
            } catch (err) {
                console.warn('[Dashboard] Gagal memuat riwayat grafik:', err);
            }
        },

        /**
         * Inisialisasi Chart.js Dual Axis (Suhu & Gas)
         */
        initChart() {
            const ctx = document.getElementById('liveSensorChart');
            if (!ctx) return;

            const isDark = true;
            const gridColor = 'rgba(255, 255, 255, 0.08)';
            const textColor = '#94a3b8';

            this.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Suhu Ruangan (°C)',
                            data: [],
                            borderColor: '#f97316', // Orange / Api
                            backgroundColor: 'rgba(249, 115, 22, 0.15)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2.5,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            yAxisID: 'yTemp'
                        },
                        {
                            label: 'Kadar Asap/Gas (PPM)',
                            data: [],
                            borderColor: '#38bdf8', // Cyan / Asap
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2.5,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            yAxisID: 'yGas'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e2e8f0',
                                font: { family: 'Inter, sans-serif', size: 12, weight: '500' }
                            }
                        },
                        tooltip: {
                            backgroundColor: '#0f172a',
                            titleColor: '#f8fafc',
                            bodyColor: '#cbd5e1',
                            borderColor: '#334155',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }
                        },
                        yTemp: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Suhu (°C)',
                                color: '#f97316',
                                font: { weight: 'bold' }
                            },
                            suggestedMin: 20,
                            suggestedMax: 60,
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        yGas: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Gas (PPM)',
                                color: '#38bdf8',
                                font: { weight: 'bold' }
                            },
                            suggestedMin: 100,
                            suggestedMax: 800,
                            grid: { drawOnChartArea: false },
                            ticks: { color: textColor }
                        }
                    }
                }
            });
        },

        /**
         * Mengisi data historis awal ke dalam Chart.js
         */
        populateChart(records) {
            if (!this.chartInstance) return;

            const labels = [];
            const tempData = [];
            const gasData = [];

            records.forEach(r => {
                const timeStr = r.created_at 
                    ? new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '-';
                labels.push(timeStr);
                tempData.push(r.temperature);
                gasData.push(r.gas_level);
            });

            this.chartInstance.data.labels = labels;
            this.chartInstance.data.datasets[0].data = tempData;
            this.chartInstance.data.datasets[1].data = gasData;
            this.chartInstance.update('none');
        },

        /**
         * Menambahkan satu titik data live ke grafik
         */
        pushChartData(temp, gas, date) {
            if (!this.chartInstance) return;

            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const maxPoints = (window.CONFIG && window.CONFIG.CHART_MAX_POINTS) || 30;

            const labels = this.chartInstance.data.labels;
            const tempData = this.chartInstance.data.datasets[0].data;
            const gasData = this.chartInstance.data.datasets[1].data;

            labels.push(timeStr);
            tempData.push(temp);
            gasData.push(gas);

            if (labels.length > maxPoints) {
                labels.shift();
                tempData.shift();
                gasData.shift();
            }

            this.chartInstance.update('none');
        },

        /**
         * Logika Sirine Alarm Suara (Web Audio API)
         */
        handleAlarmAudio() {
            if (this.reading.alert_level === 'BAHAYA' && !this.isMuted) {
                if (window.alarmSiren && !window.alarmSiren.isPlaying) {
                    window.alarmSiren.start();
                    this.isSirenPlaying = true;
                }
            } else {
                if (window.alarmSiren && window.alarmSiren.isPlaying) {
                    window.alarmSiren.stop();
                    this.isSirenPlaying = false;
                }
            }
        },

        /**
         * Toggle Mute Sirine
         */
        toggleMute() {
            if (window.alarmSiren) {
                this.isMuted = window.alarmSiren.toggleMute();
                this.showToastNotification(
                    this.isMuted ? 'Sirine dibisukan (Muted).' : 'Suara Sirine diaktifkan (Unmuted).',
                    this.isMuted ? 'warning' : 'info'
                );
            }
        },

        /**
         * Unlock AudioContext melalui tombol interaksi user
         */
        unlockAudio() {
            if (window.alarmSiren) {
                window.alarmSiren.unlockAudio();
                this.isAudioUnlocked = true;
            }
        },

        /**
         * Mengubah Mode Sistem (Auto Mode vs Manual Override)
         */
        async setAutoMode(mode) {
            await this.sendControlUpdate({ auto_mode: mode });
            this.showToastNotification(
                mode ? 'Mode Otomatis (Rule Engine) diaktifkan.' : 'Mode Manual Override diaktifkan.',
                'info'
            );
        },

        /**
         * Toggle Status Kipas Manual
         */
        async toggleFanOverride() {
            if (this.control.auto_mode) {
                this.showToastNotification('Ubah ke Mode Manual terlebih dahulu untuk mengontrol Kipas.', 'warning');
                return;
            }
            const nextState = !this.control.fan_override;
            await this.sendControlUpdate({ fan_override: nextState });
            this.showToastNotification(`Kipas Exhaust diatur ke: ${nextState ? 'ON' : 'OFF'}.`, 'success');
        },

        /**
         * Toggle Status Pompa Air Manual
         */
        async togglePumpOverride() {
            if (this.control.auto_mode) {
                this.showToastNotification('Ubah ke Mode Manual terlebih dahulu untuk mengontrol Pompa Air.', 'warning');
                return;
            }
            const nextState = !this.control.pump_override;
            await this.sendControlUpdate({ pump_override: nextState });
            this.showToastNotification(`Pompa Air Mini diatur ke: ${nextState ? 'ON' : 'OFF'}.`, 'success');
        },

        /**
         * Menyimpan Ambang Batas Baru (Threshold)
         */
        async saveThresholds() {
            this.isSavingThreshold = true;
            const temp = parseFloat(this.thresholdForm.temp_threshold);
            const gas = parseFloat(this.thresholdForm.gas_threshold);

            if (isNaN(temp) || temp < 20 || temp > 120) {
                this.showToastNotification('Ambang suhu harus antara 20°C - 120°C.', 'error');
                this.isSavingThreshold = false;
                return;
            }

            if (isNaN(gas) || gas < 50 || gas > 4000) {
                this.showToastNotification('Ambang gas harus antara 50 - 4000 PPM.', 'error');
                this.isSavingThreshold = false;
                return;
            }

            const success = await this.sendControlUpdate({
                temp_threshold: temp,
                gas_threshold: gas
            });

            this.isSavingThreshold = false;

            if (success) {
                this.showToastNotification('Ambang batas berhasil disimpan ke backend!', 'success');
            }
        },

        /**
         * Mengirim request update kontrol ke POST /api/dashboard/control
         */
        async sendControlUpdate(payload) {
            const baseUrl = (window.CONFIG && window.CONFIG.API_BASE_URL) || 'http://127.0.0.1:8000/api';
            this.isUpdatingControl = true;

            try {
                const response = await fetch(`${baseUrl}/dashboard/control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const json = await response.json();

                if (response.ok && json.status === 'success') {
                    if (json.control) {
                        this.control.auto_mode = Boolean(json.control.auto_mode);
                        this.control.fan_override = Boolean(json.control.fan_override);
                        this.control.pump_override = Boolean(json.control.pump_override);
                        this.control.temp_threshold = parseFloat(json.control.temp_threshold);
                        this.control.gas_threshold = parseFloat(json.control.gas_threshold);
                    }
                    this.isUpdatingControl = false;
                    return true;
                } else {
                    throw new Error(json.message || 'Gagal menyimpan perubahan.');
                }
            } catch (error) {
                console.error('[Dashboard] Error control update:', error);
                this.showToastNotification(`Gagal: ${error.message}`, 'error');
                this.isUpdatingControl = false;
                return false;
            }
        },

        /**
         * Menampilkan notifikasi Toast kecil
         */
        showToastNotification(message, type = 'info') {
            this.toast.message = message;
            this.toast.type = type;
            this.toast.show = true;

            setTimeout(() => {
                this.toast.show = false;
            }, 3500);
        }
    };
}

window.fireDashboard = fireDashboard;
