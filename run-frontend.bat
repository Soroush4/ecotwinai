@echo off
echo ========================================
echo Starting EcoTwinAI Frontend Server
echo ========================================
echo.
cd /d "%~dp0"

echo Checking for Python...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python found! Starting server on port 8080...
    echo.
    echo Frontend will be available at: http://localhost:8080
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    python -m http.server 8080
    goto :end
)

echo Python not found. Trying npx serve...
npx --yes serve -l 8080
if %errorlevel% neq 0 (
    echo.
    echo Error: Could not start server!
    echo Please install Python or ensure Node.js is available.
    echo.
    pause
)

:end

