import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { isExecutableOnPath } from "./which";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-which-test-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("isExecutableOnPath", () => {
  it("finds an executable on the given PATH", () => {
    const bin = path.join(tmp, "mytool");
    fs.writeFileSync(bin, "#!/bin/sh\n", { mode: 0o755 });
    expect(isExecutableOnPath("mytool", tmp)).toBe(true);
  });

  it("ignores a non-executable file of the same name", () => {
    fs.writeFileSync(path.join(tmp, "plain"), "x", { mode: 0o644 });
    expect(isExecutableOnPath("plain", tmp)).toBe(false);
  });

  it("returns false when not present", () => {
    expect(isExecutableOnPath("definitely-not-here", tmp)).toBe(false);
  });

  it("rejects names containing path separators", () => {
    const bin = path.join(tmp, "mytool");
    fs.writeFileSync(bin, "#!/bin/sh\n", { mode: 0o755 });
    expect(isExecutableOnPath("../mytool", tmp)).toBe(false);
    expect(isExecutableOnPath(bin, tmp)).toBe(false);
  });

  it("searches multiple PATH entries", () => {
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "vc-which2-"));
    try {
      fs.writeFileSync(path.join(dir2, "tool2"), "#!/bin/sh\n", { mode: 0o755 });
      expect(isExecutableOnPath("tool2", [tmp, dir2].join(path.delimiter))).toBe(true);
    } finally {
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  });
});
