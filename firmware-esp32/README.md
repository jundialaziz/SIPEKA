# Firmware ESP32 - Sistem Peringatan Dini Kebakaran Berbasis IoT

Firmware ini dirancang untuk mikrokontroler **ESP32** menggunakan Arduino framework (didukung oleh **PlatformIO** maupun **Arduino IDE**). Firmware bertanggung jawab membaca sensor secara real-time, mengirim telemetri ke Laravel REST API Backend, mengeksekusi perintah aktuator (relay kipas & pompa air), serta menyediakan mekanisme **Local Autonomous Fail-Safe** jika jaringan internet terputus.

---

## 📌 Diagram Pengkabelan (Wiring Table)

### 1. Sensor Suhu LM35
> ⚠️ **Catatan Penting ADC ESP32:** Sensor analog WAJIB menggunakan pin **ADC1 (GPIO 32–39)** karena channel ADC2 dimatikan secara internal oleh silikon ESP32 saat radio Wi-Fi aktif.
- **Pin VCC (+)**  ➜ Pin **3.3V** atau **5V** ESP32
- **Pin VOUT (Tengah)** ➜ Pin **GPIO 34** (ADC1 Channel 6)
- **Pin GND (-)**  ➜ Pin **GND** ESP32

### 2. Sensor Asap & Gas MQ-2
- **Pin VCC** ➜ Pin **5V (VIN)** ESP32 (MQ-2 membutuhkan heater 5V agar sensitif)
- **Pin GND** ➜ Pin **GND** ESP32 (Common Ground)
- **Pin A0 (Analog Out)** ➜ Pin **GPIO 35** (ADC1 Channel 7)
- **Pin D0 (Digital Out)** ➜ Pin **GPIO 32**

### 3. Modul Relay 2-Channel (Active LOW)
> ⚠️ **Peringatan Daya Listrik:** Kipas Exhaust (12V DC) dan Pompa Air Mini (5V–12V DC) memiliki lonjakan arus induktif saat start-up. **JANGAN mengambil daya pompa/kipas dari pin 3.3V ESP32** untuk mencegah *brownout reset*. Gunakan adaptor daya terpisah untuk beban dengan kabel ground yang saling terhubung (Common Ground).
- **Pin VCC Relay** ➜ Pin **5V (VIN)** ESP32
- **Pin GND Relay** ➜ Pin **GND** ESP32
- **Pin IN1 (Kipas)** ➜ Pin **GPIO 26**
- **Pin IN2 (Pompa)** ➜ Pin **GPIO 27**

### 4. Buzzer Alarm & Indikator (Opsional)
- **Pin Positif Buzzer** ➜ Pin **GPIO 25**
- **Pin Negatif Buzzer** ➜ Pin **GND** ESP32

---

## 🔧 Ringkasan Pemetaan Pinout (Pinout Summary)

| Komponen | Pin Komponen | Pin ESP32 | Keterangan |
| :--- | :--- | :--- | :--- |
| **LM35** | VOUT | **GPIO 34** | ADC1_CH6 (Tegangan 10 mV / °C) |
| **MQ-2** | A0 | **GPIO 35** | ADC1_CH7 (Kadar Gas/Asap Analog) |
| **MQ-2** | D0 | **GPIO 32** | Digital Threshold Trigger |
| **Relay IN1** | IN1 | **GPIO 26** | Kipas Exhaust (Active LOW) |
| **Relay IN2** | IN2 | **GPIO 27** | Pompa Air (Active LOW) |
| **Buzzer** | V+ | **GPIO 25** | Alarm Audio Lokal |
| **Status LED**| Onboard | **GPIO 2** | Indikator Wi-Fi & Booting |

---

## ⚙️ Logika Kontrol Aktuator (Rule Matrix)

Sistem menggunakan logika **Active LOW** untuk modul relay:
- Logika `LOW` (0V) = Relay **ON** (Kipas / Pompa Menyala).
- Logika `HIGH` (3.3V) = Relay **OFF** (Kipas / Pompa Mati).

| Kondisi Sensor | Status Sistem | Kipas Exhaust | Pompa Air | Buzzer |
| :--- | :---: | :---: | :---: | :---: |
| Suhu < Batas DAN Gas < Batas | `AMAN` | **OFF** | **OFF** | **OFF** |
| Suhu >= Batas ATAU Gas >= Batas | `WASPADA` | **ON** *(Membuang Asap)* | **OFF** | **OFF** |
| Suhu >= Batas DAN Gas >= Batas | `BAHAYA` | **ON** | **ON** *(Pemadaman Awal)* | **ON** |

---

## 🚀 Panduan Kompilasi & Upload

### Menggunakan PlatformIO (Disarankan)
1. Buka folder `/firmware-esp32` di VS Code yang telah terpasang ekstensi **PlatformIO IDE**.
2. Buka file `src/config.h`, lalu sesuaikan:
   - `WIFI_SSID` dan `WIFI_PASSWORD`
   - `BACKEND_TELEMETRY_URL` (contoh: `http://192.168.1.15:8000/api/iot/telemetry`)
3. Hubungkan board ESP32 ke komputer via kabel Micro-USB / Type-C.
4. Klik tombol **Build (✓)** pada status bar PlatformIO, lalu klik **Upload (➔)**.
5. Buka Serial Monitor pada baud rate `115200`.

### Menggunakan Arduino IDE
1. Buka Arduino IDE, pastikan board package **esp32 by Espressif Systems** sudah terpasang.
2. Pasang library **ArduinoJson** (versi 7.x) via Library Manager (`Ctrl+Shift+I`).
3. Buat sketch baru atau salin isi `src/main.cpp` dan `src/config.h`.
4. Pilih board: **ESP32 Dev Module**.
5. Pilih port COM yang sesuai, lalu klik **Upload**.
