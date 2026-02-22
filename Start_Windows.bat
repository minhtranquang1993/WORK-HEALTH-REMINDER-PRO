@echo off
title Work Health Reminder PRO
echo.
echo  ==========================================
echo   Work Health Reminder PRO - Windows
echo  ==========================================
echo.

REM Kiểm tra Python
python --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [LOI] Chua cai Python!
    echo Vao https://python.org de tai ve nhe!
    echo Nho tick "Add Python to PATH" khi cai dat.
    pause
    start https://python.org/downloads
    exit /b 1
)

REM Kiểm tra và cài win10toast
python -c "import win10toast" >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [INFO] Dang cai thu vien win10toast...
    pip install win10toast --quiet
)

echo [OK] Dang khoi dong app...
echo.
python reminder_pro.py
pause
