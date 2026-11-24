# Frontend Web Dashboard - GitHub Pages Ready

Aplikasi web dashboard statis real-time untuk **Sistem Peringatan Dini Kebakaran Berbasis IoT**, dirancang khusus agar dapat di-hosting langsung di **GitHub Pages** tanpa memerlukan server Node.js / PHP di sisi frontend.

---

## 🚀 Fitur Unggulan Dashboard

1. **Kompatibel 100% dengan GitHub Pages**: Terdiri atas file statis (`HTML5`, `Tailwind CSS via CDN`, `Alpine.js`, dan `Chart.js`).
2. **Audio Sirine Alarm Sintetis (Web Audio API)**:
   - Menghasilkan nada sirine darurat frekuensi ganda secara sintetis di dalam browser tanpa dependensi file MP3 eksternal (anti-CORS, anti-404).
   - Dilengkapi tombol kontrol **Mute / Unmute** dan pembuka kunci izin audio (*AudioContext Unlock*).
3. **Emergency Flashing Banner**:
   - Banner merah berkedip beranimasi tinggi saat status berubah menjadi `BAHAYA`.
   - Banner amber saat status `WASPADA`.
4. **4 Kartu Telemetri Real-Time**:
   - Suhu (°C) dengan gauge dan komparasi ambang batas.
   - Kadar Gas & Asap (PPM / Level ADC).
   - Kipas Exhaust (indikator animasi putaran kipas saat aktif).
   - Pompa Air Mini (indikator animasi aliran air saat pemadaman aktif).
5. **Live Dual-Axis Line Chart**:
   - Grafik pergerakan dinamika suhu dan asap secara langsung via Chart.js.
6. **Panel Kendali Interaktif**:
   - Toggle **Mode Otomatis** (dikendalikan Rule Engine backend) vs **Mode Manual Override**.
   - Tombol manual ON/OFF Kipas Exhaust dan Pompa Air.
   - Form kustomisasi ambang batas (*Threshold*) suhu dan gas langsung ke backend.
7. **Tabel Log Kejadian & Telegram Dispatch**:
   - Menampilkan 8 riwayat insiden terakhir beserta status pengiriman notifikasi ke Telegram Bot.

---

## ⚙️ Konfigurasi URL API Backend (`config.js`)

Buka file `config.js`, sesuaikan variabel `API_BASE_URL` sesuai domain backend Laravel Anda:

```javascript
const CONFIG = {
    // Ganti dengan URL domain backend publik Anda (misal Railway, Render, VPS, Ngrok)
    API_BASE_URL: 'https://iot-fire-alarm.up.railway.app/api',
    POLL_INTERVAL_MS: 2000,
    CHART_MAX_POINTS: 30
};
```

---

## 🌐 Cara Deploy ke GitHub Pages via GitHub Actions

1. Buat repository baru di GitHub dan upload keseluruhan proyek ini.
2. Buka repository Anda di GitHub: **Settings** ➔ **Pages**.
3. Pada bagian **Build and deployment** ➔ **Source**, pilih **GitHub Actions**.
4. Workflow di `.github/workflows/deploy.yml` akan otomatis aktif setiap kali Anda melakukan `git push` ke branch `main`.
5. URL dashboard Anda akan aktif di format: `https://<username>.github.io/<nama-repo>/`.
