@echo off
REM Deploy TrustBot API to Fly.io

echo Deploying TrustBot API to Fly.io...
echo.

cd /d "%~dp0.."
flyctl deploy

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Deployment successful!
    echo URL: https://trustbot-api.fly.dev
    echo.
    echo Testing health endpoint...
    curl -s https://trustbot-api.fly.dev/health
    echo.
) else (
    echo.
    echo Deployment failed. Check the logs above.
)
