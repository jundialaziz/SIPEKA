# Sistem Peringatan Dini Kebakaran Berbasis IoT (End-to-End)

Proyek sistem peringatan dini kebakaran berbasis IoT berstandar *production-ready* yang mengintegrasikan mikrokontroler **ESP32**, **Laravel 11 REST API & Rule Engine**, **Telegram Bot Alert System**, serta **Web Dashboard Statis Modern** yang siap di-deploy ke **GitHub Pages**.

---

## 🏛️ Arsitektur Sistem

```mermaid
flowchart TD
    subgraph EdgeDevice["Mikrokontroler & Hardware (ESP32)"]
        LM35["Sensor Suhu LM35 (GPIO 34)"] -->|ADC Analog mV| ESP["ESP32 Controller"]
        MQ2["Sensor Asap MQ-2 (GPIO 35/32)"] -->|Analog & Digital| ESP
        ESP -->|Active LOW| R1["Relay 1: Kipas Exhaust (GPIO 26)"]
        ESP -->|Active LOW| R2["Relay 2: Pompa Air Mini (GPIO 27)"]
        ESP -->|Active HIGH| BUZZ["Buzzer Alarm (GPIO 25)"]
    end

    subgraph BackendLaravel["Backend Server (Laravel 11)"]
        API["REST API Ingestion (/api/iot/telemetry)"]
        RULE["Fire Rule Engine & Actuator Decider"]
        DB[(Database MySQL / PostgreSQL)]
        TEL_SRV["Telegram Notification Service (Anti-Spam)"]
        DASH_API["Dashboard Endpoints (/api/dashboard/*)"]

        API --> RULE
        RULE --> DB
        RULE --> TEL_SRV
        DB --> DASH_API
    end

    subgraph ExternalServices["Layanan Pihak Ketiga & Cloud"]
        TELEGRAM["Telegram Bot API (Notifikasi Darurat)"]
        GHPAGES["GitHub Pages (Static Hosting)"]
    end

    subgraph FrontendWeb["Web Dashboard (GitHub Pages Ready)"]
        UI["Tailwind CSS + Alpine.js + Chart.js"]
        AUDIO["Web Audio API (Emergency Siren)"]
        UI --- AUDIO
    end

    ESP <-->|HTTP POST JSON (Setiap 2.5s)| API
    TEL_SRV -->|Alert Markdown| TELEGRAM
    UI <-->|Polling 2s & CORS Enabled| DASH_API
    GHPAGES -.->|Hosting File Statis| UI
```

---

## 📁 Struktur Direktori Monorepo

```text
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions auto-deploy ke GitHub Pages
├── firmware-esp32/
│   ├── src/
│   │   ├── config.h                # Konfigurasi pinout, Wi-Fi, dan URL API backend
│   │   └── main.cpp                # Firmware utama ESP32 (ADC calibration & fail-safe)
│   ├── platformio.ini              # Konfigurasi environment PlatformIO
│   ├── simulate_esp32.js           # Skrip simulasi telemetri tanpa hardware fisik
│   └── README.md                   # Dokumentasi skematik & wiring hardware
├── backend-laravel/
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── TelemetryController.php # Endpoint penerima telemetri ESP32
│   │   │   └── DashboardController.php # Endpoint data live, chart & kontrol
│   │   ├── Models/
│   │   │   ├── SensorReading.php   # Model riwayat telemetri sensor
│   │   │   ├── DeviceControl.php   # Model pengaturan mode & ambang batas
│   │   │   └── AlertLog.php        # Model log peringatan & status telegram
│   │   └── Services/
│   │       ├── FireRuleEngineService.php # Evaluasi status & keputusan relay
│   │       └── TelegramService.php # Layanan bot telegram dengan Anti-Spam
│   ├── bootstrap/
│   │   └── app.php                 # Inisialisasi API routes & middleware CORS
│   ├── config/
│   │   ├── cors.php                # CORS configuration (*.github.io allowed)
│   │   ├── services.php            # Konfigurasi token Telegram Bot
│   │   └── database.php            # Driver MySQL, PostgreSQL, SQLite
│   ├── database/
│   │   ├── migrations/             # Migrasi tabel sensor, kontrol, dan log
│   │   └── seeders/                # Default threshold & initial record
│   ├── routes/
│   │   ├── api.php                 # Rute REST API
│   │   └── web.php
│   ├── .env.example
│   └── README.md
├── frontend-gh-pages/
│   ├── index.html                  # Halaman dashboard Tailwind CSS & Alpine.js
│   ├── app.js                      # Reactive state & polling data real-time
│   ├── audio.js                    # Web Audio API emergency fire siren generator
│   ├── config.js                   # Konfigurasi terpusat API_BASE_URL backend
│   └── README.md
└── README.md                       # Dokumentasi utama proyek
```

---

## ⚡ Ringkasan Pinout Hardware (ESP32)

| Komponen Hardware | Pin Komponen | Pin ESP32 | Logika / Karakteristik |
| :--- | :--- | :--- | :--- |
| **LM35 (Sensor Suhu)** | VOUT | **GPIO 34** | ADC1_CH6 (Tegangan 10 mV / °C) |
| **MQ-2 (Sensor Gas/Asap)** | A0 (Analog) | **GPIO 35** | ADC1_CH7 (0 – 4095 ADC Level / PPM) |
| **MQ-2 (Sensor Gas/Asap)** | D0 (Digital) | **GPIO 32** | Digital Threshold (Active LOW) |
| **Relay Channel 1 (Kipas Exhaust)** | IN1 | **GPIO 26** | **Active LOW** (LOW = ON, HIGH = OFF) |
| **Relay Channel 2 (Pompa Air Mini)** | IN2 | **GPIO 27** | **Active LOW** (LOW = ON, HIGH = OFF) |
| **Buzzer Alarm Lokal** | V+ | **GPIO 25** | Active HIGH |
| **LED Indikator Onboard** | Onboard | **GPIO 2** | Status koneksi Wi-Fi |

> ⚠️ **Catatan Penting Catu Daya:** Pompa air dan kipas exhaust menghasilkan arus induktif saat berputar. **Gunakan catu daya/adaptor terpisah (misal 5V–12V DC)** untuk beban relay, dan hubungkan semua GND secara bersamaan (*Common Ground*). Jangan mengambil daya pompa langsung dari pin 3.3V ESP32 untuk menghindari *brownout reset*.

---

## 🧠 Matriks Logika Keputusan (Rule Engine)

| Kondisi Parameter Sensor | Status Sistem | Kipas Exhaust | Pompa Air | Sirine / Buzzer | Notifikasi Telegram |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Suhu < Batas **DAN** Gas < Batas | **`AMAN`** | **OFF** | **OFF** | **OFF** | Kirim pemulihan jika sebelumnya darurat |
| Suhu >= Batas **ATAU** Gas >= Batas | **`WASPADA`** | **ON** *(Buang Asap)* | **OFF** | **OFF** | Dikirim saat transisi |
| Suhu >= Batas **DAN** Gas >= Batas | **`BAHAYA`** *(Api Aktif)* | **ON** | **ON** *(Pemadaman)* | **ON** | Dikirim langsung & diulang per 60s (Anti-Spam) |

---

## 🛠️ Panduan Langkah demi Langkah Instalasi & Menjalankan

### Langkah 1: Setup Backend Laravel 11
1. Masuk ke direktori backend:
   ```bash
   cd backend-laravel
   ```
2. Install dependensi dan konfigurasi environment:
   ```bash
   composer install
   cp .env.example .env
   php artisan key:generate
   ```
3. Sesuaikan konfigurasi database dan Telegram di `.env`:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=iot_fire_alarm
   DB_USERNAME=root
   DB_PASSWORD=

   # Konfigurasi Telegram Bot
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_CHAT_ID=987654321
   ```
4. Jalankan migrasi dan seeder database:
   ```bash
   php artisan migrate --seed
   ```
5. Jalankan server Laravel:
   ```bash
   php artisan serve --host=0.0.0.0 --port=8000
   ```

---

### Langkah 2: Setup Bot Telegram untuk Alert Notifikasi
1. Buka aplikasi Telegram, cari **@BotFather**, ketik `/newbot`, lalu ikuti instruksi hingga mendapatkan **HTTP API Bot Token**.
2. Dapatkan **Chat ID**:
   - Kirim pesan ke bot Anda atau undang bot ke grup monitoring.
   - Buka bot **@userinfobot** di Telegram untuk melihat User ID Anda, atau tambahkan bot ke grup dan gunakan bot **@RawDataBot** untuk melihat Group Chat ID.
3. Masukkan `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` ke file `.env` Laravel.

---

### Langkah 3: Setup & Upload Firmware ESP32
1. Buka folder `firmware-esp32` menggunakan VS Code (dengan ekstensi **PlatformIO**) atau **Arduino IDE**.
2. Buka file `src/config.h`, lalu sesuaikan:
   - `WIFI_SSID` & `WIFI_PASSWORD`.
   - `BACKEND_TELEMETRY_URL` (contoh: `http://192.168.1.15:8000/api/iot/telemetry`).
3. Hubungkan board ESP32 ke laptop/PC via kabel data USB.
4. Klik **Upload** dan buka Serial Monitor pada baud rate `115200`.

> 💡 **Opsi Uji Coba Cepat Tanpa Hardware (Simulator):**
> Anda dapat mensimulasikan pembacaan sensor ESP32 langsung dari terminal dengan menjalankan:
> ```bash
> node firmware-esp32/simulate_esp32.js
> ```
> Skrip ini secara otomatis mensimulasikan siklus suhu normal, asap naik, kebakaran aktif, dan pemadaman.

---

### Langkah 4: Menjalankan Dashboard Frontend & Deploy ke GitHub Pages

#### Pengujian Lokal
Cukup buka file `frontend-gh-pages/index.html` di browser Anda (atau jalankan ekstensi VS Code *Live Server*). File `config.js` secara otomatis mengarahkan koneksi ke `http://127.0.0.1:8000/api` saat diakses dari localhost.

#### Deploy ke GitHub Pages
1. Push repository ini ke GitHub:
   ```bash
   git add .
   git commit -m "feat: complete iot fire alarm system"
   git push origin main
   ```
2. Buka repository di GitHub: **Settings** ➔ **Pages**.
3. Di bagian **Build and deployment** ➔ **Source**, pilih opsi **GitHub Actions**.
4. File workflow `.github/workflows/deploy.yml` akan mempublikasikan folder `frontend-gh-pages/` secara otomatis.
5. Pada file `frontend-gh-pages/config.js`, ubah `API_BASE_URL` ke alamat publik server backend Laravel Anda (misalnya via Ngrok, Cloudflare Tunnel, Railway, atau VPS).
