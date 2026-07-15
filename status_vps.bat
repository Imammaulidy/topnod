@echo off
title Cek Status Web Worker VPS
echo ==========================================
echo       STATUS WEB WORKER DI VPS
echo ==========================================
echo.
ssh -i "C:\Users\fajar\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@178.128.89.114 "pm2 status web-worker"
echo.
echo ==========================================
pause
