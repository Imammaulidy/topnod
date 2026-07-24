#!/bin/bash

echo "============================================="
echo "   MEMPERBAIKI WEB BOT & NGINX OTOMATIS      "
echo "============================================="

echo "[1/4] Menghapus dan Menjalankan Ulang Bot (Port 3001)"
pm2 delete app 2>/dev/null
pm2 delete bot-trio-merak 2>/dev/null
cd /home/root1/topnod/web_worker
pm2 start app.py --name "bot-trio-merak" --interpreter python3
pm2 save

echo "[2/4] Membersihkan Konfigurasi Nginx Lama"
sudo rm -f /etc/nginx/sites-enabled/highcards.biz.id.conf
sudo rm -f /etc/nginx/sites-available/highcards.biz.id.conf

echo "[3/4] Membuat Konfigurasi Nginx Baru untuk highcards.biz.id"
sudo tee /etc/nginx/sites-available/highcards.biz.id.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name highcards.biz.id www.highcards.biz.id;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo "[4/4] Mengaktifkan Nginx & Menginstal Sertifikat SSL"
sudo ln -s /etc/nginx/sites-available/highcards.biz.id.conf /etc/nginx/sites-enabled/
sudo systemctl restart nginx
sudo certbot --nginx -d highcards.biz.id -d www.highcards.biz.id --non-interactive --agree-tos -m admin@highcards.biz.id --redirect

echo "============================================="
echo " SELESAI! Silakan buka https://highcards.biz.id"
echo "============================================="
