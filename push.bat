@echo off
title Auto Push ke GitHub - TOPNOD
color 0A

echo =======================================================
echo              PUSH UPDATE KE GITHUB (TOPNOD)
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

cd /d "%~dp0"

echo [1/3] Menambahkan semua perubahan (git add)...
"%GIT_CMD%" add .
echo.

set /p commit_msg="Masukkan pesan commit (tekan Enter untuk 'Update Otomatis'): "
if "%commit_msg%"=="" set commit_msg=Update Otomatis
echo [2/3] Membuat Commit: "%commit_msg%"...
"%GIT_CMD%" commit -m "%commit_msg%"
echo.

echo [3/3] Mengunggah (Push) ke Github (branch: main)...
"%GIT_CMD%" push origin main
echo.

if %errorlevel% equ 0 (
    echo =======================================================
    echo   BERHASIL! Perubahan telah terunggah ke GitHub.
    echo =======================================================
) else (
    echo =======================================================
    echo   GAGAL! Terjadi kesalahan saat push ke GitHub.
    echo =======================================================
)

echo.
pause
