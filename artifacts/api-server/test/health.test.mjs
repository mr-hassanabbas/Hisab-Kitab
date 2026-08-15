import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(__dirname, "..", "dist", "index.mjs");
const port = 4100;

function waitForServer(portNumber) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tryConnect = () => {
      const req = http.get({ host: "127.0.0.1", port: portNumber, path: "/api/healthz" }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > 10000) {
          reject(new Error("Timed out waiting for server"));
          return;
        }
        setTimeout(tryConnect, 100);
      });
    };
    tryConnect();
  });
}

function requestJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: pathname }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on("error", reject);
  });
}

test("GET /api/health returns ok", async () => {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(port);
    const response = await requestJson("/api/health");
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { status: "ok" });
  } finally {
    child.kill("SIGTERM");
  }
});
