@echo off
REM Start TrustBot API on Fly.io
REM Scales the app to 1 machine

echo Starting TrustBot API on Fly.io...
flyctl scale count 1 --app trustbot-api --yes

if %ERRORLEVEL% EQU 0 (
    echo.
    echo API started successfully!
    echo URL: https://trustbot-api.fly.dev
    echo.
    echo Checking status...
    flyctl status --app trustbot-api
) else (
    echo.
    echo Failed to start. Make sure you're logged in: flyctl auth login
)
