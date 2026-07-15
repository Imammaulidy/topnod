@echo off
title SSH Login ke VPS (Live Log Bot)
echo ==========================================
echo       MEMANTAU BOT DI VPS (LIVE)
echo ==========================================
echo.
echo Menghubungkan ke server...
ssh -t -i "C:\Users\fajar\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@178.128.89.114 "pm2 logs web-worker"
pause
