@echo off
:: Cek apakah dijalankan sebagai Administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Sukses: Menjalankan dengan hak Administrator.
) else (
    echo Meminta hak Administrator...
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B
)

echo ===================================================
echo   Memperbaiki Firewall untuk VSPhone Web Worker
echo ===================================================

:: Menghapus aturan BLOCK yang memblokir python.exe (Ini penyebab utamanya!)
echo Menghapus blokir Python di Firewall...
powershell -Command "Remove-NetFirewallRule -DisplayName 'python.exe' -Action Block -ErrorAction SilentlyContinue"

:: Memastikan Port TCP 5000 dan 5001 Terbuka
echo Membuka Port 5000 dan 5001...
netsh advfirewall firewall add rule name="VSPhone Web Worker 5000-5001" dir=in action=allow protocol=TCP localport=5000,5001 >nul 2>&1

echo.
echo Selesai! Firewall yang memblokir Python sudah dihapus.
echo Silakan coba akses kembali dari HP Anda.
pause
