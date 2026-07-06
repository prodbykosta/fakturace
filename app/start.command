#!/bin/bash
# Fakturace — spouštěč (poklepej v Finderu)
cd "$(dirname "$0")"
if curl -s --max-time 1 http://localhost:4321/api/ping > /dev/null 2>&1; then
  echo "Server už běží."
  open "http://localhost:4321"
  exit 0
fi
open_browser() { sleep 1.2; open "http://localhost:4321"; }
open_browser &
exec /opt/homebrew/bin/node server.js
