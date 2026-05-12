import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

export interface TranscribeOptions {
  apiKey: string;
  model: string;
  systemInstruction: string;
  wavPath: string;
  signal?: AbortSignal;
}

export async function transcribe(opts: TranscribeOptions): Promise<string> {
  const audioBase64 = await fs.promises.readFile(opts.wavPath, { encoding: "base64" });

  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  const response = await ai.models.generateContent({
    model: opts.model,
    config: {
      systemInstruction: opts.systemInstruction,
      // Low temperature — we want deterministic transcription, not creative paraphrasing
      temperature: 0,
      abortSignal: opts.signal,
    },
    contents: [
      {
        role: "user",
        parts: [
          // Neutral cue — the *system instruction* decides language/format.
          // Saying "transcribe" here causes Gemini to preserve the source
          // language and silently override the system instruction's
          // translation directive.
          { text: "Process the attached audio per the system instruction. Output only the resulting text, nothing else." },
          { inlineData: { mimeType: "audio/wav", data: audioBase64 } },
        ],
      },
    ],
  });

  const text = response.text;
  if (!text || !text.trim()) {
    throw new Error("Gemini returned an empty transcript. Try speaking longer or louder.");
  }
  return text.trim();
}
