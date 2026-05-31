import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Return true if `bin` is an executable found on PATH.
 *
 * Replaces `execSync(\`command -v ${bin}\`)` — no shell, so a tool name can
 * never be interpreted as shell syntax, and it's faster (no subprocess).
 */
export function isExecutableOnPath(bin: string, pathEnv = process.env.PATH ?? ""): boolean {
  // Reject anything that isn't a bare command name (defense in depth).
  if (!bin || bin.includes("/") || bin.includes("\\")) return false;
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    try {
      fs.accessSync(path.join(dir, bin), fs.constants.X_OK);
      return true;
    } catch {
      /* not here; keep looking */
    }
  }
  return false;
}
