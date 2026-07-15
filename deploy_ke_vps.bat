@echo off
title Deploy Web Worker ke VPS
echo ==========================================
echo        DEPLOY KE VPS OROMATIS
echo ==========================================
echo.
echo Mengompres file lokal...
powershell -Command "Compress-Archive -Path 'C:\Users\fajar\OneDrive\Desktop\BOT TOPNOD IMAM\*' -DestinationPath 'C:\Users\fajar\OneDrive\Desktop\bot_topnod.zip' -Force"

echo.
echo Mengirim file ke VPS...
scp -i "C:\Users\fajar\.ssh\id_ed25519" -o StrictHostKeyChecking=no C:\Users\fajar\OneDrive\Desktop\bot_topnod.zip root@178.128.89.114:/root/

echo.
echo Mengekstrak dan me-restart Web Worker di VPS...
ssh -i "C:\Users\fajar\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@178.128.89.114 "unzip -o /root/bot_topnod.zip -d /root/topnod && cd /root/topnod/web_worker && pm2 restart web-worker"

echo.
echo ==========================================
echo           DEPLOY SELESAI!
echo ==========================================
pause
