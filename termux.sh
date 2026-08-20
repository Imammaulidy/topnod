#!/bin/bash
echo "==================================================="
echo "       Menjalankan VSPhone Web Worker Server       "
echo "==================================================="
echo "Akses Dashboard di browser: http://localhost:3001"
echo "Atau dari IP lokal perangkat: http://$(hostname -I 2>/dev/null | awk '{print $1}'):3001"
echo "==================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/web_worker" || cd web_worker || { echo "Folder web_worker tidak ditemukan!"; exit 1; }

while true; do
    if command -v python3 >/dev/null 2>&1; then
        python3 app.py
    else
        python app.py
    fi
    echo ""
    echo "Server sedang di-restart dalam 2 detik..."
    sleep 2
done
