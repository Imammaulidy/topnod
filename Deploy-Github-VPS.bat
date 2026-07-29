@echo off
title Auto Commit Github ^& VPS Update
color 0A

echo =======================================================
echo          AUTO COMMIT GITHUB ^& UPDATE VPS
echo =======================================================
echo.

:: 1. GIT ADD
echo [1/4] Menambahkan semua perubahan ke Git...
git add .
echo.

:: 2. GIT COMMIT
set /p commit_msg="Masukkan pesan commit (tekan Enter untuk 'Update Otomatis'): "
if "%commit_msg%"=="" set commit_msg=Update Otomatis
echo [2/4] Melakukan Commit: "%commit_msg%"...
git commit -m "%commit_msg%"
echo.

:: 3. GIT PUSH
echo [3/4] Mengunggah (Push) ke Github...
git push origin main
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
set VPS_RESTART_CMD=systemctl restart vsphone
:: Jika Anda memakai pm2, ubah VPS_RESTART_CMD menjadi: pm2 restart all

echo Menjalankan perintah Git Pull di VPS...
ssh %VPS_USER%@%VPS_HOST% "cd '%VPS_DIR%' && git pull origin main && %VPS_RESTART_CMD%"

echo.
echo =======================================================
echo PROSES SELESAI! Web VPS seharusnya sudah terupdate.
echo =======================================================
pause
