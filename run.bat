@echo off
title Web Bot TopNod - Highcards.my.id
color 0A

echo ===============================================================
echo            MEMULAI SERVER WEB BOT (VSPhone API)
echo ===============================================================
echo.
echo Pastikan Anda sudah mematikan server lama (jika ada).
echo.
echo Akses Web Bot di browser Anda melalui link berikut:
echo http://127.0.0.1:3001
echo.
echo ===============================================================

:: Auto-detect Python binary
set "PY_CMD=python"
where python >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
        set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    ) else if exist "C:\Python311\python.exe" (
        set "PY_CMD=C:\Python311\python.exe"
    )
)

cd /d "%~dp0\web_worker"

:loop
"%PY_CMD%" app.py
echo.
echo Server sedang di-reboot / restart...
timeout /t 2 >nul
goto loop
