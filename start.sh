#!/bin/bash
set -e

echo "=== Hisab Kitab — Startup ==="

# Kill any stale processes on our ports
echo "Freeing ports..."
lsof -ti tcp:8080 | xargs -r kill -9 || true
lsof -ti tcp:5173 | xargs -r kill -9 || true
sleep 2

echo "Starting API server (port 8080)..."
PORT=8080 pnpm --filter @workspace/api-server run dev > /tmp/api.log 2>&1 &

echo "Waiting for API server..."
for i in $(seq 1 20); do
  curl -sf http://localhost:8080/api/healthz > /dev/null 2>&1 && break
  sleep 1
done
echo "API server ready."

echo "Starting frontend (port 5173)..."
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hisab-kitab run dev > /tmp/frontend.log 2>&1 &

echo "Waiting for frontend..."
for i in $(seq 1 30); do
  curl -sf http://localhost:5173 > /dev/null 2>&1 && break
  sleep 1
done
echo "Frontend ready."

echo "=== Both services running ==="
wait
