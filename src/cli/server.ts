import * as http from "node:http";
import { GoogleGenAI } from "@google/genai";

import {
  loadConfig, saveConfig, loadApiKey, saveApiKey, clearApiKey,
  configDir, configFile, apiKeyFile,
} from "./config";
import { readHistory, clearHistory, readLogLines, clearLogs } from "./store";
import { pasteToolName } from "./inject";
import { renderUi } from "./ui";

export interface ServerHandle {
  port: number;
  url: string;
  close: () => Promise<void>;
}

export function startServer(opts: { host?: string; port?: number } = {}): Promise<ServerHandle> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 7777;

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("[voice-coder ui] handler error:", err);
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        port: boundPort,
        url: `http://${host}:${boundPort}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

// ---------- routes ----------

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const { pathname } = url;
  const method = req.method ?? "GET";

  // CORS for completeness — UI is served from the same origin so usually unused
  res.setHeader("Cache-Control", "no-store");

  // Static page
  if (pathname === "/" && method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderUi());
    return;
  }

  // ----- config -----
  if (pathname === "/api/config" && method === "GET") {
    return sendJson(res, 200, {
      config: loadConfig(),
      paths: { configFile: configFile(), apiKeyFile: apiKeyFile(), configDir: configDir() },
      pasteTool: pasteToolName(),
    });
  }
  if (pathname === "/api/config" && method === "PUT") {
    const body = await readJson<Partial<import("./config").CliConfig>>(req);
    saveConfig(body);
    return sendJson(res, 200, { config: loadConfig() });
  }

  // ----- api key -----
  if (pathname === "/api/api-key" && method === "GET") {
    const key = loadApiKey();
    return sendJson(res, 200, { set: !!key, masked: key ? maskKey(key) : null });
  }
  if (pathname === "/api/api-key" && method === "PUT") {
    const body = await readJson<{ key?: string }>(req);
    if (!body.key || !body.key.trim()) return sendJson(res, 400, { error: "key required" });
    saveApiKey(body.key.trim());
    return sendJson(res, 200, { set: true, masked: maskKey(body.key.trim()) });
  }
  if (pathname === "/api/api-key" && method === "DELETE") {
    clearApiKey();
    return sendJson(res, 200, { set: false });
  }

  // ----- test connection -----
  if (pathname === "/api/test-connection" && method === "POST") {
    return testConnection(res);
  }

  // ----- history -----
  if (pathname === "/api/history" && method === "GET") {
    return sendJson(res, 200, { entries: readHistory(200) });
  }
  if (pathname === "/api/history" && method === "DELETE") {
    clearHistory();
    return sendJson(res, 200, { ok: true });
  }

  // ----- logs -----
  if (pathname === "/api/logs" && method === "GET") {
    return sendJson(res, 200, { lines: readLogLines(500) });
  }
  if (pathname === "/api/logs" && method === "DELETE") {
    clearLogs();
    return sendJson(res, 200, { ok: true });
  }

  // ----- 404 -----
  sendJson(res, 404, { error: "not found" });
}

// ---------- helpers ----------

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJson<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({} as T);
      try { resolve(JSON.parse(raw) as T); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function maskKey(k: string): string {
  if (k.length <= 8) return "•".repeat(k.length);
  return k.slice(0, 4) + "•".repeat(Math.max(0, k.length - 8)) + k.slice(-4);
}

async function testConnection(res: http.ServerResponse): Promise<void> {
  const cfg = loadConfig();
  const apiKey = loadApiKey();
  if (!apiKey) {
    return sendJson(res, 400, { ok: false, error: "No API key set." });
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const t0 = Date.now();
    const resp = await ai.models.generateContent({
      model: cfg.model,
      config: { temperature: 0, maxOutputTokens: 20 },
      contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
    });
    const ms = Date.now() - t0;
    const text = (resp.text ?? "").trim();
    sendJson(res, 200, { ok: true, model: cfg.model, latencyMs: ms, sample: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 200, { ok: false, model: cfg.model, error: msg });
  }
}
