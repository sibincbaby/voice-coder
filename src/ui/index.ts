// Server-side accessors for the dashboard assets.
//
// index.html and style.css are inlined into the CLI bundle at build time
// (esbuild --loader:.html=text --loader:.css=text). The client app is a
// separate browser bundle (out/dashboard.js, built from ./app.ts) served
// from disk so it stays real, type-checked TypeScript instead of a string.

import * as fs from "node:fs";
import * as path from "node:path";

import page from "./index.html";
import styles from "./style.css";

/** The dashboard page with the per-session CSRF token embedded. */
export function renderPage(token: string): string {
  return page.replace("__VC_TOKEN__", token);
}

export function styleSheet(): string {
  return styles;
}

/**
 * The compiled client bundle. At runtime __dirname is out/, where
 * compile:ui placed dashboard.js. Returns null if the bundle is missing
 * (e.g. running from source without a full `pnpm run compile`).
 */
export function clientScript(): string | null {
  try {
    return fs.readFileSync(path.join(__dirname, "dashboard.js"), "utf8");
  } catch {
    return null;
  }
}
