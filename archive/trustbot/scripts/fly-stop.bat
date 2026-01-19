@echo off
REM Stop TrustBot API on Fly.io
REM Scales the app to 0 machines (no charges when stopped)

echo Stopping TrustBot API on Fly.io...
flyctl scale count 0 --app trustbot-api --yes

if %ERRORLEVEL% EQU 0 (
    echo.
    echo API stopped successfully!
    echo No charges while scaled to 0.
    echo.
    echo To restart: scripts\fly-start.bat
) else (
    echo.
    echo Failed to stop. Make sure you're logged in: flyctl auth login
)
