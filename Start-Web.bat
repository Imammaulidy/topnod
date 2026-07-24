@echo off
title Web Bot TopNod - Highcards.my.id
color 0A

echo ===============================================================
echo            MEMULAI SERVER WEB BOT (VSPhone API)
echo ===============================================================
echo.
echo Pastikan Anda sudah mematikan server lama di port 3000.
echo Aplikasi akan berjalan di localhost port 3000.
echo.
echo Jika file hosts/tunnel sudah di-setting, akses lewat:
echo http://highcards.my.id
echo atau
echo http://127.0.0.1:3000
echo.
echo ===============================================================

cd web_worker
python app.py

pause
