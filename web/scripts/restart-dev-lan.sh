#!/usr/bin/env bash
# One command: free port 3000, clear stale Next cache, start billing for Mac + phone.
set -e
cd "$(dirname "$0")/.."

echo "Stopping anything on ports 3000 and 3001..."
for PORT in 3000 3001; do
  for _ in 1 2 3 4 5; do
    PIDS=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -z "$PIDS" ]; then
      break
    fi
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    sleep 1
  done
done
pkill -f "next dev.*3000" 2>/dev/null || true
pkill -f "next dev.*3001" 2>/dev/null || true
pkill -f "next start.*3000" 2>/dev/null || true
sleep 1

if lsof -ti :3000 >/dev/null 2>&1; then
  echo "ERROR: Port 3000 is still in use. Close other terminals running web/, then retry:"
  echo "  npm run dev:clean"
  exit 1
fi

echo "Clearing .next cache..."
rm -rf .next node_modules/.cache

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
echo ""
echo "Starting billing app (LAN + this Mac)..."
if [ -n "$LAN_IP" ]; then
  echo "  On this Mac:  http://localhost:3000/login"
  echo "  LAN (no Google sign-in): http://${LAN_IP}:3000/login"
  echo "  iPhone + sign-in:       https://ha-billing.vercel.app/login"
  echo "  (Google OAuth does not allow 192.168.x.x — use Vercel on phones.)"
else
  echo "  http://localhost:3000/login"
fi
echo ""

exec npm run dev:lan
