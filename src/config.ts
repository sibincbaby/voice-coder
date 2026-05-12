import * as vscode from "vscode";
import type { AudioToolPref } from "./recorder";
import type { InjectionMethod } from "./injector";

const SECRET_KEY = "voiceCoder.apiKey";

export interface ResolvedConfig {
  apiKey: string;
  model: string;
  systemInstruction: string;
  audioTool: AudioToolPref;
  sampleRate: number;
  injectionMethod: InjectionMethod;
  maxRecordingSeconds: number;
  restoreClipboard: boolean;
}

export async function readConfig(context: vscode.ExtensionContext): Promise<ResolvedConfig | null> {
  const apiKey = await context.secrets.get(SECRET_KEY);
  if (!apiKey) return null;
  const cfg = vscode.workspace.getConfiguration("voiceCoder");
  return {
    apiKey,
    model: cfg.get<string>("model", "gemini-3.1-flash-lite"),
    systemInstruction: cfg.get<string>("systemInstruction", ""),
    audioTool: cfg.get<AudioToolPref>("audioTool", "auto"),
    sampleRate: cfg.get<number>("sampleRate", 16000),
    injectionMethod: cfg.get<InjectionMethod>("injectionMethod", "clipboard-paste"),
    maxRecordingSeconds: cfg.get<number>("maxRecordingSeconds", 120),
    restoreClipboard: cfg.get<boolean>("restoreClipboard", true),
  };
}

export async function promptForApiKey(context: vscode.ExtensionContext): Promise<string | null> {
  const key = await vscode.window.showInputBox({
    title: "Gemini API Key",
    prompt: "Get one at https://aistudio.google.com/apikey",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "AIza...",
    validateInput: (v) => (v && v.trim().length > 10 ? null : "Key looks too short"),
  });
  if (!key) return null;
  await context.secrets.store(SECRET_KEY, key.trim());
  return key.trim();
}

export async function clearApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}
