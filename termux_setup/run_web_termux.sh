#!/bin/bash
echo "==================================================="
echo "       Menjalankan VSPhone Web Worker Server       "
echo "==================================================="
echo "Membuka port 5000..."
echo "Silakan buka browser di HP Anda ke: http://localhost:5000"
echo "Atau buka dari PC ke IP HP Anda (misal: http://192.168.x.x:5000)"
echo ""

cd "$(dirname "$0")/web_worker" || { echo "Gagal menemukan folder web_worker"; exit 1; }

while true; do
    python app.py
    echo "Server sedang di-reboot..."
    sleep 1
done
