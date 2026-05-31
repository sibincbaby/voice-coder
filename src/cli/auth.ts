import { randomBytes, timingSafeEqual } from "node:crypto";

// CSRF / cross-origin protection for the dashboard HTTP server.
//
// The server binds to 127.0.0.1, but that is NOT enough on its own: any web
// page the user visits can issue `fetch('http://127.0.0.1:7777/api/...')`.
// Browsers allow cross-origin "simple" POSTs (the response is hidden by CORS,
// but the side effect — start recording, rewrite the system instruction —
// still happens). A page could also use DNS rebinding so the Host header is
// an attacker domain pointing at 127.0.0.1.
//
// Defense:
//   1. A per-process random token embedded in the served HTML. The UI sends it
//      as `X-VC-Token` on every /api call. A foreign page cannot read our HTML
//      (CORS), so it cannot learn the token.
//   2. A Host allowlist (localhost / 127.0.0.1[:port]) blocks DNS rebinding.
// The `/` page and `/api/health` are exempt (no secrets, needed to bootstrap).

export function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export function hostAllowed(host: string | undefined): boolean {
  if (!host) return true; // some clients omit Host on HTTP/1.0; not a browser CSRF vector
  const h = host.split(":")[0].toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "[::1]" || h === "::1";
}

export function tokenValid(provided: string | string[] | undefined, expected: string): boolean {
  const got = Array.isArray(provided) ? provided[0] : provided;
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

export interface AuthDecision {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Routes that never require the token (bootstrap + liveness probe). */
export function isExemptPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/api/health";
}

export function authorize(
  pathname: string,
  headers: { host?: string; token?: string | string[] },
  token: string,
): AuthDecision {
  if (isExemptPath(pathname)) return { ok: true };
  if (!hostAllowed(headers.host)) {
    return { ok: false, status: 403, error: "Host not allowed" };
  }
  if (!tokenValid(headers.token, token)) {
    return { ok: false, status: 403, error: "Missing or invalid session token" };
  }
  return { ok: true };
}
