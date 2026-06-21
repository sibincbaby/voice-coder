import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { listProfiles, getActive, activate, create, update, remove } from "./profiles";

let tmp: string;
const origEnv = { ...process.env };

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vc-profiles-test-"));
  process.env.XDG_CONFIG_HOME = tmp;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  process.env = { ...origEnv };
});

describe("first-run migration", () => {
  it("seeds a Default profile from config and makes it active", () => {
    const { profiles, activeId } = listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Default");
    expect(activeId).toBe(profiles[0].id);
    expect(getActive().name).toBe("Default");
  });
});

describe("create", () => {
  it("adds a profile inheriting config from the active one", () => {
    const p = create({ name: "Malayalam raw", systemInstruction: "verbatim" });
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("Malayalam raw");
    expect(p.systemInstruction).toBe("verbatim");
    expect(listProfiles().profiles).toHaveLength(2);
  });

  it("assigns a distinct color when possible", () => {
    const a = getActive();
    const b = create({ name: "Second" });
    expect(b.color).not.toBe(a.color);
  });
});

describe("activate", () => {
  it("switches the active profile", () => {
    const p = create({ name: "Other" });
    activate(p.id);
    expect(getActive().id).toBe(p.id);
  });

  it("throws for an unknown id", () => {
    expect(() => activate("nope")).toThrow(/No profile/);
  });
});

describe("update", () => {
  it("patches fields but never the id", () => {
    const p = create({ name: "Edit me" });
    const updated = update(p.id, { name: "Edited", model: "gemini-x" } as never);
    expect(updated.id).toBe(p.id);
    expect(updated.name).toBe("Edited");
    expect(updated.model).toBe("gemini-x");
  });
});

describe("remove", () => {
  it("deletes a profile and reassigns active if needed", () => {
    const p = create({ name: "Doomed" });
    activate(p.id);
    remove(p.id);
    expect(listProfiles().profiles.find((x) => x.id === p.id)).toBeUndefined();
    expect(getActive().id).not.toBe(p.id);
  });

  it("refuses to delete the only profile", () => {
    const only = listProfiles().profiles[0];
    expect(() => remove(only.id)).toThrow(/only profile/);
  });
});
