# Backend Laravel 11 - IoT Fire Early Warning System

Backend REST API, Database Manager, Rule Engine, dan Telegram Bot Controller untuk Sistem Peringatan Dini Kebakaran Berbasis IoT.

---

## 🏗️ Fitur & Arsitektur Backend

1. **Ingestion Telemetri Real-Time**: Menerima data sensor dari ESP32 setiap 2.5 detik.
2. **Rule Engine Cerdas**:
   - Status `AMAN` : Suhu < Batas DAN Gas < Batas (Kipas OFF, Pompa OFF).
   - Status `WASPADA` : Suhu >= Batas ATAU Gas >= Batas (Kipas ON membuang asap, Pompa OFF).
   - Status `BAHAYA` : Suhu >= Batas DAN Gas >= Batas (Kipas ON & Pompa Air Mini ON memadamkan api).
3. **Manual Override Support**: Dashboard web dapat mengambil alih kendali aktuator relay secara manual (mematikan/menyalakan kipas atau pompa secara paksa).
4. **Telegram Bot Emergency Alert**:
   - Format pesan **Markdown informatif**.
   - Dilengkapi sistem **Anti-Spam / Cooldown**: Notifikasi dikirim saat terjadi transisi status (`AMAN` ➔ `WASPADA` / `BAHAYA`), dibatasi maksimal 1 kali per 60 detik selama status masih `BAHAYA`, dan mengirim notifikasi pemulihan saat kondisi kembali `AMAN`.
5. **CORS Friendly**: Dikonfigurasi mendukung akses dari origin GitHub Pages (`*.github.io`) dan localhost.

---

## 📋 Skema Database

- **`sensor_readings`**: Riwayat pembacaan sensor (`id`, `temperature`, `gas_level`, `gas_digital`, `fan_status`, `pump_status`, `alert_level`, `mac_address`, `created_at`).
- **`device_controls`**: Pengaturan sistem (`id`, `auto_mode`, `fan_override`, `pump_override`, `temp_threshold`, `gas_threshold`, `updated_at`).
- **`alert_logs`**: Log peringatan dan status pengiriman ke Telegram (`id`, `alert_level`, `message`, `sent_to_telegram`, `created_at`).

---

## 🚀 Panduan Instalasi & Menjalankan Backend

### 1. Prasyarat
- PHP >= 8.2 (didukung oleh XAMPP / Laragon).
- Composer terinstall.
- Database MySQL atau PostgreSQL (atau SQLite).

### 2. Langkah Setup
```bash
# Masuk ke direktori backend
cd backend-laravel

# Install dependensi PHP
composer install

# Buat file konfigurasi .env
cp .env.example .env

# Generate Application Key
php artisan key:generate

# Konfigurasi Database di file .env:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=iot_fire_alarm
# DB_USERNAME=root
# DB_PASSWORD=

# Buat database iot_fire_alarm di phpMyAdmin / MySQL, lalu jalankan migrasi & seeder:
php artisan migrate --seed

# Jalankan server lokal Laravel
php artisan serve --host=0.0.0.0 --port=8000
```

> **Catatan Uji Coba Cepat dengan SQLite:**
> Jika belum ingin menyiapkan MySQL, cukup ubah `DB_CONNECTION=sqlite` di file `.env`, buat file kosong `database/database.sqlite`, lalu jalankan `php artisan migrate --seed`.

---

## 🤖 Panduan Setup Telegram Bot Alert

1. Buka aplikasi Telegram dan cari **@BotFather**.
2. Kirim perintah `/newbot`, ikuti petunjuk hingga mendapatkan **HTTP API Token** (contoh: `7123456789:AAFx...`).
3. Dapatkan **Chat ID**:
   - Kirim pesan ke bot Anda, atau masukkan bot ke dalam grup Telegram yang diinginkan.
   - Cari bot **@userinfobot** di Telegram untuk mendapatkan User ID Anda, atau gunakan `@RawDataBot` untuk Chat ID grup (biasanya diawali tanda minus, misal: `-100123456789`).
4. Masukkan kedua nilai tersebut ke file `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=7123456789:AAFx...
   TELEGRAM_CHAT_ID=123456789
   ```

---

## 📡 Dokumentasi Endpoint REST API

### 1. Ingestion Telemetri Sensor (ESP32 ➔ Backend)
- **Method & URL:** `POST /api/iot/telemetry`
- **Request Headers:** `Content-Type: application/json`, `Accept: application/json`
- **Request Body (JSON):**
  ```json
  {
    "temperature": 48.5,
    "gas_level": 550,
    "gas_digital": true,
    "fan_status": false,
    "pump_status": false,
    "mac_address": "84:0D:8E:22:11:00"
  }
  ```
- **Response Success (200 OK):**
  ```json
  {
    "status": "success",
    "reading_id": 142,
    "alert_level": "BAHAYA",
    "command": {
      "fan": true,
      "pump": true,
      "auto_mode": true
    },
    "thresholds": {
      "temp_threshold": 45.0,
      "gas_threshold": 400.0
    },
    "server_time": "2026-11-20 14:15:30"
  }
  ```

### 2. Ambil Status Real-Time Terbaru (Dashboard Frontend)
- **Method & URL:** `GET /api/dashboard/latest`
- **Response Success (200 OK):** Mengembalikan pembacaan sensor terakhir, status online ESP32, pengaturan threshold, dan 8 alert log terakhir.

### 3. Ambil Data Riwayat untuk Grafik (Chart.js)
- **Method & URL:** `GET /api/dashboard/history?limit=50`
- **Response Success (200 OK):** Mengembalikan deret data urut kronologis pembacaan sensor.

### 4. Update Kontrol & Mode Manual (Dashboard Frontend)
- **Method & URL:** `POST /api/dashboard/control`
- **Request Body (JSON):**
  ```json
  {
    "auto_mode": false,
    "fan_override": true,
    "pump_override": false,
    "temp_threshold": 48.0,
    "gas_threshold": 450.0
  }
  ```
