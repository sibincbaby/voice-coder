import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { configDir, ensureConfigDir, loadConfig } from "./config";
import type { AudioToolPref } from "../recorder";

export interface Profile {
  id: string;
  name: string;
  color: string;              // hex tint for the tile
  model: string;
  systemInstruction: string;
  audioTool: AudioToolPref;
  sampleRate: number;
  maxRecordingSeconds: number;
  autoPaste: boolean;
  notify: boolean;
}

interface ProfilesFile {
  activeId: string;
  profiles: Profile[];
}

function profilesFile(): string { return path.join(configDir(), "profiles.json"); }

const PALETTE = [
  "#7aa7ff", // blue
  "#5cdd8b", // green
  "#ffb454", // amber
  "#ff7a90", // pink
  "#b48cff", // purple
  "#5ed4e0", // teal
  "#ffd166", // yellow
  "#ff9d6f", // orange
];

// Pick a color that isn't already used by another profile; cycle if all used
function pickColor(existing: Profile[]): string {
  const used = new Set(existing.map((p) => p.color));
  for (const c of PALETTE) if (!used.has(c)) return c;
  return PALETTE[existing.length % PALETTE.length];
}

function loadFile(): ProfilesFile {
  ensureConfigDir();
  const f = profilesFile();
  if (!fs.existsSync(f)) return migrateOrSeed();
  try {
    const parsed = JSON.parse(fs.readFileSync(f, "utf8")) as ProfilesFile;
    if (!parsed.profiles || parsed.profiles.length === 0) return migrateOrSeed();
    // Guard against an activeId that no longer matches any profile
    if (!parsed.profiles.some((p) => p.id === parsed.activeId)) {
      parsed.activeId = parsed.profiles[0].id;
      saveFile(parsed);
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Could not parse ${f}: ${(err as Error).message}\n` +
      `Fix the JSON syntax or delete the file to regenerate from defaults.`,
    );
  }
}

function saveFile(state: ProfilesFile): void {
  ensureConfigDir();
  fs.writeFileSync(profilesFile(), JSON.stringify(state, null, 2));
}

// First-run: build a "Default" profile from whatever config.json the user
// already has, so upgrading users don't lose their custom system instruction.
function migrateOrSeed(): ProfilesFile {
  const cfg = loadConfig();
  const def: Profile = {
    id: "default",
    name: "Default",
    color: PALETTE[0],
    model: cfg.model,
    systemInstruction: cfg.systemInstruction,
    audioTool: cfg.audioTool,
    sampleRate: cfg.sampleRate,
    maxRecordingSeconds: cfg.maxRecordingSeconds,
    autoPaste: cfg.autoPaste,
    notify: cfg.notify,
  };
  const state: ProfilesFile = { activeId: "default", profiles: [def] };
  saveFile(state);
  return state;
}

// ----------------- public API -----------------

export function listProfiles(): { activeId: string; profiles: Profile[] } {
  return loadFile();
}

export function getActive(): Profile {
  const state = loadFile();
  return state.profiles.find((p) => p.id === state.activeId) ?? state.profiles[0];
}

export function activate(id: string): Profile {
  const state = loadFile();
  if (!state.profiles.some((p) => p.id === id)) {
    throw new Error(`No profile with id '${id}'.`);
  }
  state.activeId = id;
  saveFile(state);
  return state.profiles.find((p) => p.id === id) as Profile;
}

export function create(seed: Partial<Profile> & { name: string }): Profile {
  const state = loadFile();
  const fromActive = state.profiles.find((p) => p.id === state.activeId);
  const defaults: Omit<Profile, "id" | "name" | "color"> = fromActive
    ? {
        model: fromActive.model,
        systemInstruction: fromActive.systemInstruction,
        audioTool: fromActive.audioTool,
        sampleRate: fromActive.sampleRate,
        maxRecordingSeconds: fromActive.maxRecordingSeconds,
        autoPaste: fromActive.autoPaste,
        notify: fromActive.notify,
      }
    : {
        model: "gemini-3.1-flash-lite",
        systemInstruction: "",
        audioTool: "auto",
        sampleRate: 16000,
        maxRecordingSeconds: 120,
        autoPaste: true,
        notify: true,
      };

  const profile: Profile = {
    id: seed.id ?? randomUUID(),
    name: seed.name.trim() || "Untitled",
    color: seed.color ?? pickColor(state.profiles),
    ...defaults,
    ...stripUndefined(seed),
  };

  state.profiles.push(profile);
  saveFile(state);
  return profile;
}

export function update(id: string, patch: Partial<Profile>): Profile {
  const state = loadFile();
  const idx = state.profiles.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`No profile with id '${id}'.`);
  const next: Profile = { ...state.profiles[idx], ...stripUndefined(patch), id: state.profiles[idx].id };
  state.profiles[idx] = next;
  saveFile(state);
  return next;
}

export function remove(id: string): void {
  const state = loadFile();
  if (state.profiles.length <= 1) {
    throw new Error("Cannot delete the only profile.");
  }
  const idx = state.profiles.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`No profile with id '${id}'.`);
  state.profiles.splice(idx, 1);
  if (state.activeId === id) {
    state.activeId = state.profiles[0].id;
  }
  saveFile(state);
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(obj) as (keyof T)[]) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}
