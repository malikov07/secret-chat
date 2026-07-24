# Run the Django + Channels dev server (WebSocket-capable via daphne).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
& "$PSScriptRoot\venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000
