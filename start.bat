@echo off
echo ========================================
echo    MindBuddy - Dang khoi dong...
echo ========================================

:: Cai dat backend neu chua co node_modules
echo [1/3] Kiem tra Backend dependencies...
cd /d "C:\Users\ACER\Desktop\MindBuddy\backend"
if not exist node_modules (
    echo Cai dat backend dependencies...
    npm install
    if errorlevel 1 (
        echo LOI: Khong the cai dat backend dependencies!
        pause
        exit /b 1
    )
)

:: Cai dat frontend neu chua co node_modules
echo [2/3] Kiem tra Frontend dependencies...
cd /d "C:\Users\ACER\Desktop\MindBuddy\frontend"
if not exist node_modules (
    echo Cai dat frontend dependencies...
    npm install
    if errorlevel 1 (
        echo LOI: Khong the cai dat frontend dependencies!
        pause
        exit /b 1
    )
)

:: Khoi dong Backend trong cua so rieng
echo [3/3] Khoi dong Backend va Frontend...
cd /d "C:\Users\ACER\Desktop\MindBuddy\backend"
start "MindBuddy - Backend :5000" cmd /k "color 0A && echo Backend dang chay tai http://localhost:5000 && node src/index.js"

:: Doi 2 giay de backend khoi dong truoc
timeout /t 2 /nobreak >nul

:: Khoi dong Frontend trong cua so rieng
cd /d "C:\Users\ACER\Desktop\MindBuddy\frontend"
set NODE_OPTIONS=--openssl-legacy-provider
start "MindBuddy - Frontend :3000" cmd /k "color 0B && echo Frontend dang khoi dong tai http://localhost:3000 && npm start"

echo.
echo ========================================
echo  Ca hai server da duoc khoi dong!
echo  Backend  : http://localhost:5000
echo  Frontend : http://localhost:3000
echo ========================================
echo  Dong cua so nay de tat ca server van chay.
echo  De dung server, dong cac cua so Backend/Frontend.
echo ========================================
exit
