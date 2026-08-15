#!/bin/bash
set -e

echo "=== 1. Pulling latest code ==="
git pull origin main || { git fetch origin && git reset --hard origin/main; }

echo "=== 2. Installing dependencies ==="
pnpm install || true

echo "=== 3. Checking PostgreSQL ==="
sudo service postgresql start || echo "PostgreSQL might already be running or requires manual start."

echo "=== 4. Pushing database schema ==="
export DATABASE_URL='postgres://postgres:postgres@localhost:5432/hisabkitab'
pnpm --filter @workspace/db run push

echo "=== 5. Starting services in background ==="
export JWT_SECRET='test-secret'

# Kill stale ports
lsof -ti tcp:8081 | xargs -r kill -9 || true
lsof -ti tcp:5173 | xargs -r kill -9 || true

export PORT=8081
pnpm --filter @workspace/api-server run dev > /tmp/api.log 2>&1 &
echo "Waiting 8 seconds for API server..."
sleep 8

export PORT=5173
export BASE_PATH='/'
pnpm --filter @workspace/hisab-kitab run dev > /tmp/frontend.log 2>&1 &
echo "Waiting 8 seconds for frontend server..."
sleep 8

echo "=== 6. Creating user account ==="
curl -s -X POST http://localhost:8081/api/auth/setup \
-H 'Content-Type: application/json' \
-d '{"name":"Muhammad Arshad",
"mobile":"03104900363",
"pin":"1234",
"confirmPin":"1234"}'
echo -e "\nUser setup request sent."

echo "=== 7. Confirming both services are running ==="
echo "API Health Check (Port 8081):"
curl -I http://localhost:8081/api/healthz

echo "Frontend Check (Port 5173):"
curl -I http://localhost:5173

echo "=== SETUP COMPLETE ==="
echo "Please check the terminal output above to verify the setup."
