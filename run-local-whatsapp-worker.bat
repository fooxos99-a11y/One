@echo off
setlocal
cd /d "%~dp0"

if not exist ".env.local-worker" (
  echo Missing .env.local-worker
  echo Copy .env.local-worker.example to .env.local-worker and fill in the values.
  exit /b 1
)

set "WORKER_ENV_FILE=.env.local-worker"
set "WHATSAPP_WORKER_MODE=local"
if "%WHATSAPP_DEVICE_LABEL%"=="" set "WHATSAPP_DEVICE_LABEL=الجهاز الحالي"

call npm run worker:whatsapp
