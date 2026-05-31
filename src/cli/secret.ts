/** Mask an API key for display, keeping only the first/last 4 characters. */
export function maskKey(k: string): string {
  if (k.length <= 8) return "•".repeat(k.length);
  return k.slice(0, 4) + "•".repeat(Math.max(0, k.length - 8)) + k.slice(-4);
}
