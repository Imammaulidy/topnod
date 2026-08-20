@echo off
title Auto Commit Github ^& VPS Update
color 0A

echo =======================================================
echo          AUTO COMMIT GITHUB ^& UPDATE VPS
echo =======================================================
echo.

:: Auto-detect Git binary
set "GIT_CMD=git"
where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%USERPROFILE%\MinGit\cmd\git.exe" (
        set "GIT_CMD=%USERPROFILE%\MinGit\cmd\git.exe"
    ) else if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    )
)

:: 1. GIT ADD
echo [1/4] Menambahkan semua perubahan ke Git...
"%GIT_CMD%" add .
echo.

:: 2. GIT COMMIT
set /p commit_msg="Masukkan pesan commit (tekan Enter untuk 'Update Otomatis'): "
if "%commit_msg%"=="" set commit_msg=Update Otomatis
echo [2/4] Melakukan Commit: "%commit_msg%"...
"%GIT_CMD%" commit -m "%commit_msg%"
echo.

:: 3. GIT PUSH
echo [3/4] Mengunggah (Push) ke Github...
"%GIT_CMD%" push origin main
:: Jika branch Anda bernama master, ubah "main" menjadi "master" di atas.
echo.

:: 4. UPDATE VPS VIA SSH
echo =======================================================
echo [4/4] UPDATE OTOMATIS KE VPS (highcards.biz.id)
echo =======================================================
echo Catatan: Pastikan Anda sudah login SSH sebelumnya atau tahu password VPS.
echo.

:: SESUAIKAN VARIABEL DI BAWAH INI DENGAN VPS ANDA:
set VPS_USER=root1
set VPS_HOST=52.231.78.20
set VPS_DIR=/home/root1/topnod
set VPS_RESTART_CMD=pm2 restart all

echo Menjalankan perintah Git Pull di VPS...
ssh %VPS_USER%@%VPS_HOST% "cd '%VPS_DIR%' && git reset --hard HEAD && git pull origin main && %VPS_RESTART_CMD%"

echo.
echo =======================================================
echo PROSES SELESAI! Web VPS seharusnya sudah terupdate.
echo =======================================================
pause
