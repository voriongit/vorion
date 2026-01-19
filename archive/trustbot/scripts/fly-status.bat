@echo off
REM Check TrustBot API status on Fly.io

echo TrustBot API Status
echo ====================
echo.

flyctl status --app trustbot-api

echo.
echo ---
echo URL: https://trustbot-api.fly.dev
echo Health: https://trustbot-api.fly.dev/health
