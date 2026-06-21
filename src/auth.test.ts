import { describe, it, expect } from "vitest";
import { generateToken, hostAllowed, tokenValid, isExemptPath, authorize } from "./auth";

describe("generateToken", () => {
  it("produces a long random hex token", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });
});

describe("hostAllowed", () => {
  it("allows localhost variants", () => {
    expect(hostAllowed("127.0.0.1:7777")).toBe(true);
    expect(hostAllowed("localhost:7777")).toBe(true);
    expect(hostAllowed("127.0.0.1")).toBe(true);
  });
  it("rejects foreign hosts (DNS rebinding)", () => {
    expect(hostAllowed("evil.com")).toBe(false);
    expect(hostAllowed("attacker.test:7777")).toBe(false);
  });
  it("permits a missing Host header (non-browser clients)", () => {
    expect(hostAllowed(undefined)).toBe(true);
  });
});

describe("tokenValid", () => {
  const token = "a".repeat(48);
  it("accepts the exact token", () => {
    expect(tokenValid(token, token)).toBe(true);
  });
  it("rejects wrong / missing / wrong-length tokens", () => {
    expect(tokenValid("b".repeat(48), token)).toBe(false);
    expect(tokenValid(undefined, token)).toBe(false);
    expect(tokenValid("short", token)).toBe(false);
  });
  it("handles an array-valued header by taking the first", () => {
    expect(tokenValid([token, "x"], token)).toBe(true);
  });
});

describe("isExemptPath", () => {
  it("exempts the page and health probe only", () => {
    expect(isExemptPath("/")).toBe(true);
    expect(isExemptPath("/api/health")).toBe(true);
    expect(isExemptPath("/api/config")).toBe(false);
    expect(isExemptPath("/api/record/start")).toBe(false);
  });
});

describe("authorize", () => {
  const token = generateToken();

  it("allows exempt paths without a token", () => {
    expect(authorize("/", {}, token).ok).toBe(true);
    expect(authorize("/api/health", {}, token).ok).toBe(true);
  });

  it("allows a valid token + localhost host", () => {
    const d = authorize("/api/config", { host: "127.0.0.1:7777", token }, token);
    expect(d.ok).toBe(true);
  });

  it("rejects a foreign host", () => {
    const d = authorize("/api/config", { host: "evil.com", token }, token);
    expect(d).toEqual({ ok: false, status: 403, error: "Host not allowed" });
  });

  it("rejects a missing token", () => {
    const d = authorize("/api/config", { host: "localhost:7777" }, token);
    expect(d.ok).toBe(false);
    expect(d.status).toBe(403);
  });
});
