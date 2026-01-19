# Generate and set Fly.io secrets
$masterKey = [guid]::NewGuid().ToString()
$tokenSecret = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })

Write-Host "Setting secrets..."
Write-Host "MASTER_KEY: $masterKey"
Write-Host "TOKEN_SECRET: $tokenSecret"

Set-Location "C:\Users\racas\.gemini\antigravity\playground\scarlet-armstrong"
& "C:\Users\racas\.fly\flyctl.exe" secrets set "MASTER_KEY=$masterKey" "TOKEN_SECRET=$tokenSecret" --app trustbot-api

Write-Host ""
Write-Host "Secrets set! Save these values:"
Write-Host "MASTER_KEY=$masterKey"
Write-Host "TOKEN_SECRET=$tokenSecret"
