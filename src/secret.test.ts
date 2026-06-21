import { describe, it, expect } from "vitest";
import { maskKey } from "./secret";

describe("maskKey", () => {
  it("fully masks short keys", () => {
    expect(maskKey("short")).toBe("•••••");
    expect(maskKey("12345678")).toBe("••••••••");
  });

  it("keeps first and last 4 of longer keys", () => {
    const masked = maskKey("AIzaSyABCDEFG1234");
    expect(masked.startsWith("AIza")).toBe(true);
    expect(masked.endsWith("1234")).toBe(true);
    expect(masked).not.toContain("SyABCDEFG");
  });

  it("never leaks the middle", () => {
    const key = "AIza" + "X".repeat(30) + "9999";
    expect(maskKey(key)).not.toContain("X");
  });
});
