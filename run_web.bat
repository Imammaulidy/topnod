@echo off
title VSPhone Web Worker Server (Port 5000)
echo ===================================================
echo        Menjalankan VSPhone Web Worker Server
echo ===================================================
echo Membuka port 5000...
echo.
cd /d "%~dp0\web_worker"

:loop
python app.py
echo.
echo Server sedang di-reboot...
timeout /t 1 >nul
goto loop
