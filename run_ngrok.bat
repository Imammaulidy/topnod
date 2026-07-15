@echo off
title Ngrok Server - Web Worker
echo ==========================================
echo       MEMULAI NGROK UNTUK WEB WORKER
echo ==========================================
echo.

echo Mengkonfigurasi Ngrok Authtoken...
call npx -y ngrok config add-authtoken 3GDFWixOEbv5E6ttEkmoyaLgwDD_4P6bbnCcXp7RQYPiY2h33
echo.
echo Menjalankan Ngrok di Port 5000...
echo (Pastikan run_web.bat sudah berjalan di CMD yang lain)
echo.
call npx -y ngrok http 5000
pause
