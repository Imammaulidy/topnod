# 🚀 TOPNOD - VSPhone Cloud Phone Automation & Management Panel

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Framework-Flask-brightgreen.svg)](https://flask.palletsprojects.com/)
[![PM2](https://img.shields.io/badge/Process%20Manager-PM2-blueviolet.svg)](https://pm2.keymetrics.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20Android%20(Termux)-orange.svg)]()

**TOPNOD** adalah sistem otomasi berbasis Web Dashboard dan Worker untuk manajemen massal perangkat **VSPhone Cloud Phone**. Aplikasi ini dirancang untuk menjalankan berbagai alur kerja otomatisasi (seperti pendaftaran akun, verifikasi OTP email, input kode referral, instalasi APK, penyesuaian resolusi, hingga reset perangkat) secara paralel dan terstruktur pada puluhan hingga ratusan perangkat Cloud Phone sekaligus.

---

## 📑 Daftar Isi
- [✨ Fitur Utama](#-fitur-utama)
- [🏗️ Arsitektur Proyek](#️-arsitektur-proyek)
- [📦 Struktur Direktori](#-struktur-direktori)
- [⚙️ Persyaratan Sistem](#️-persyaratan-sistem)
- [🚀 Panduan Instalasi & Menjalankan](#-panduan-instalasi--menjalankan)
  - [1. Windows (Lokal)](#1-windows-lokal)
  - [2. Android (Termux)](#2-android-termux)
  - [3. Linux / VPS](#3-linux--vps)
- [🎮 Panduan Penggunaan Web Dashboard](#-panduan-penggunaan-web-dashboard)
- [🤖 Makro & Perintah Otomasi (Commands)](#-makro--perintah-otomasi-commands)
- [📤 Push & Update GitHub (`push.bat`)](#-push--update-github-pushbat)
- [🔒 Keamanan & Lisensi](#-keamanan--lisensi)

---

## ✨ Fitur Utama

### 1. 👥 Manajemen Akses & Multi-Tenant
- **Sistem Kode Akses (Access Code)**: Registrasi akun baru menggunakan kode akses unik dengan masa aktif tertentu (misal 24 jam atau tanpa batas).
- **Panel Admin**: Dashboard khusus admin untuk generate kode akses baru, memperpanjang durasi user, dan manajemen akun.
- **Session Isolation**: Setiap user memiliki antrian data, status PAD, dan log terpisah.

### 2. 📱 Kontrol Massal VSPhone (Cloud Phone)
- **Multi-PAD Batch Execution**: Menjalankan skrip otomasi pada banyak ID PAD secara simultan melalui VSPhone Async ADB API.
- **Real-time Status Monitoring**: Pemantauan status live setiap PAD (*Idle*, *Running*, *Paused*, *Success*, *Error*).
- **Cloud APK Installer**: Mendukung instalasi APK langsung dari Cloud Storage VSPhone (`uploadFileV3` API, transfer task, serta fallback ADB download).
- **Kontrol Penuh**: Fitur *Pause*, *Resume*, *Abort/Stop Task*, dan *Reboot Server*.

### 3. ⚡ Alur Otomasi Terintegrasi
- **Full Auto Sequences**: Eksekusi berantai mulai dari penyesuaian resolusi layar, koneksi WARP VPN, input referral, ambil email sementara & bypass OTP, setup password, prediksi, hingga logout.
- **Auto Reff Queue**: Manajemen antrian kode referral (dari input manual maupun sinkronisasi file `ref.txt`).
- **Reff Extractor**: Fitur bawaan untuk mengekstrak kode referral langsung dari teks obrolan WhatsApp.
- **Bypass OTP Email**: Otomatisasi pembacaan inbox email sementara (Temp-Mail API / IMAP) untuk verifikasi kode OTP tanpa campur tangan manual.

### 4. 🎨 Antarmuka Web Modern
- **Dual UI Version**: Tersedia tampilan Classic UI (`/`) dan Modern V2 UI (`/v2`).
- **In-App Script Editor**: Mengubah dan menyimpan konfigurasi skrip macro ADB langsung dari antarmuka web tanpa harus menyentuh kode program.

---

## 🏗️ Arsitektur Proyek

```mermaid
graph TD
    A["Pengguna / Browser Web"] -->|"HTTP / REST API"| B["Flask Server (Port 3001)"]
    B --> C["Auth & Access Control"]
    B --> D["Queue & State Manager"]
    B --> E["VsphoneAPI Client"]
    
    E -->|"HTTPS REST API"| F["VSPhone Cloud Server"]
    F -->|"vcAdb / asyncAdb"| G["Android Cloud Phones / PADs"]
    
    B -->|"Fetch OTP"| H["TempMail API / IMAP Service"]
    D <--> I["commands.json & ref.txt"]
```

---

## 📦 Struktur Direktori

```text
TOPNOD/
├── README.md                  # Dokumentasi utama proyek
├── run.bat                    # Skrip runner cepat server untuk Windows
├── run.sh                     # Skrip runner cepat server untuk Linux / VPS
├── termux.sh                  # Skrip runner cepat server untuk Android (Termux)
├── push.bat                   # Skrip auto add, commit, dan push ke GitHub
├── commands.json              # Konfigurasi perintah ADB & makro aktif
├── commands_default.json      # Backup template perintah default
├── requirements.txt           # Dependensi Python (Flask, requests)
├── ref.txt                    # (Opsional) File antrian kode referral TRPH4_
├── web_worker/                # Inti aplikasi web Flask
│   ├── app.py                 # Server backend Flask & wrapper VSPhone API
│   ├── adb_worker_ui.py       # Alternatif GUI Desktop berbasis Tkinter
│   ├── static/                # Asset CSS & JavaScript
│   │   ├── login.css
│   │   ├── style.css
│   │   ├── script.js          # Logic UI Classic (v1)
│   │   └── v2_script.js       # Logic UI Modern (v2)
│   └── templates/             # Template antarmuka HTML
│       ├── index.html         # Dashboard V1
│       ├── v2.html            # Dashboard V2
│       └── login_code.html    # Halaman Login / Register / Admin
└── ini folder data domain/    # Konfigurasi Nginx & Server Node.js (reverse proxy/domain)
    └── highcards.my.id/
        ├── highcards.my.id.conf
        └── server.js
```

---

## ⚙️ Persyaratan Sistem

- **Python**: Versi 3.8 atau lebih baru.
- **Node.js & PM2**: Untuk manajemen background process di Linux/Termux.
- **Pip**: Package manager Python.
- **Browser Modern**: Google Chrome, Mozilla Firefox, Microsoft Edge, atau Brave.
- **Koneksi Internet**: Untuk komunikasi ke API VSPhone dan TempMail.

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Windows (Lokal)

1. **Clone repository & Install dependensi (1 Command):**
   ```bash
   git clone https://github.com/Imammaulidy/topnod.git && cd topnod && pip install -r requirements.txt
   ```

2. **Jalankan Server:**
   - Cukup klik dua kali file **`run.bat`**, atau
   - Jalankan via terminal:
     ```bash
     cd web_worker && python app.py
     ```

3. **Akses Dashboard:**
   Buka browser dan kunjungi: **`http://127.0.0.1:3001`** atau **`http://localhost:3001`**.

---

### 2. Android (Termux)

1. **Update package & Install PM2:**
   ```bash
   pkg update -y && pkg install python git nodejs -y && npm install -g pm2
   ```

2. **Clone repo & Install dependensi (1 Command):**
   ```bash
   git clone https://github.com/Imammaulidy/topnod.git && cd topnod && pip install -r requirements.txt
   ```

3. **Jalankan Server:**
   - **Opsi A (Via Script `termux.sh`):**
     ```bash
     chmod +x termux.sh && ./termux.sh
     ```
   - **Opsi B (Via PM2 di Background):**
     ```bash
     pm2 start termux.sh --name "topnod"
     ```

4. **Akses Dashboard:**
   Buka browser di HP ke **`http://localhost:3001`** (atau dari PC menggunakan IP WiFi HP, misal `http://192.168.x.x:3001`).

---

### 3. Linux / VPS

1. **Persiapan Environment & Install PM2:**
   ```bash
   sudo apt update && sudo apt install python3 python3-pip git nodejs npm -y && sudo npm install -g pm2
   ```

2. **Clone repo & Install dependensi (1 Command):**
   ```bash
   git clone https://github.com/Imammaulidy/topnod.git && cd topnod && pip3 install -r requirements.txt
   ```

3. **Jalankan Server:**
   - **Menggunakan PM2 (Rekomendasi - Berjalan di Background):**
     ```bash
     pm2 start web_worker/app.py --name "topnod" --interpreter python3
     ```
   - **Atau menggunakan script `run.sh`:**
     ```bash
     chmod +x run.sh && ./run.sh
     ```

---

## 🎮 Panduan Penggunaan Web Dashboard

1. **Autentikasi**:
   - Buka halaman login di browser (`http://localhost:3001`).
   - Buat akun dengan memasukkan **Username**, **Password**, dan **Kode Akses** yang valid.
   - Untuk login Admin, gunakan menu **Login Admin** menggunakan master password (**`123123`**).

2. **Koneksi Akun VSPhone**:
   - Masukkan **Email** dan **Password** akun VSPhone Anda pada form login VSPhone.
   - *(Khusus sesi Admin, akun default `teleproyek2@gmail.com` akan otomatis terisi)*.
   - Klik **Login VSPhone** untuk mengaitkan sesi token API.

3. **Memasukkan Daftar PAD**:
   - Salin daftar ID / Kode PAD Cloud Phone Anda ke kolom textarea (1 kode per baris).
   - Klik **Load PAD** untuk memunculkan panel kontrol tiap perangkat.

4. **Eksekusi Perintah / Auto Reff**:
   - Pilih macro perintah dari dropdown (misal: `Full Auto`, `1. Reso Baru`, `4. Reff`, dll.).
   - Masukkan antrian kode referral secara manual atau klik tombol **Load ref.txt**.
   - Klik tombol **Run All PAD** atau jalankan per masing-masing PAD.

---

## 🤖 Makro & Perintah Otomasi (Commands)

Konfigurasi aksi otomatis disimpan dalam file [`commands.json`](commands.json):

| No | Nama Perintah | Deskripsi & Fungsi |
|---|---|---|
| **1** | `1. Reso Baru` | Mengubah ukuran layar dan density display ke resolusi standar otomasi |
| **2** | `2. Install Warp` | Download & instalasi aplikasi Cloudflare WARP via Split APK lalu mengaktifkan VPN |
| **3** | `3. Install` | Mengunduh dan menginstal file APK target |
| **4** | `4. Reff` | Membuka form pendaftaran dan menginput kode referral `{REFF_CODE}` |
| **5** | `5. Email` | Membuat email sementara via API, input email, menangkap OTP, dan submit verifikasi |
| **6** | `6. Password` | Menginputkan password dan konfirmasi keamanan akun |
| **7** | `7. Lihat Phrase` | Membuka menu frase akun & validasi ulang dengan OTP |
| **8** | `8. Predict Sambo` | Menjalankan navigasi tugas / prediksi |
| **9** | `9. Logout` | Melakukan logout akun dari aplikasi agar PAD siap digunakan kembali |
| **10** | `10. Reset Device` | Mengirim perintah master clear reset ke perangkat Cloud Phone |
| **11** | `11. Flush Elig` | Mengembalikan dan menyetel ulang density layar |

> 💡 **Kustomisasi Script**: Anda dapat mengubah skrip koordinat sentuh (`input tap`), penundaan (`sleep`), atau teks (`input text`) kapan saja melalui menu **Edit Scripts** di dashboard web.

---

## 📤 Push & Update GitHub (`push.bat`)

Untuk mengunggah (push) seluruh perubahan kode terbaru ke repositori GitHub:

1. Klik dua kali file **[`push.bat`](push.bat)** di root folder proyek.
2. Masukkan pesan commit yang diinginkan (atau tekan `Enter` untuk pesan default *"Update Otomatis"*).
3. Skrip akan secara otomatis mengeksekusi `git add .`, `git commit`, dan `git push origin main`.

---

## 🔒 Keamanan & Catatan

- **Jangan bagikan kredensial**: Hindari mengunggah file `vsphone_session.json` atau password admin ke repositori publik.
- **File `.gitignore`**: Pastikan token sesi, file temporary, dan data sensitif tetap masuk dalam `.gitignore`.

---

<div align="center">
  <sub>Dibuat untuk otomatisasi cerdas dan efisien bersama <b>TOPNOD & VSPhone API</b>.</sub>
</div>
