import { describe, it, expect } from "vitest";
import { validateFileMagicBytes } from "@/lib/security/file-validation";

describe("validateFileMagicBytes", () => {
  describe("PDF", () => {
    it("acepta buffer con firma PDF válida (%PDF-)", () => {
      const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(validateFileMagicBytes(buf, "pdf")).toBe(true);
    });

    it("rechaza buffer que no empieza con %PDF-", () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      expect(validateFileMagicBytes(buf, "pdf")).toBe(false);
    });

    it("rechaza buffer demasiado corto para PDF", () => {
      const buf = Buffer.from([0x25, 0x50]);
      expect(validateFileMagicBytes(buf, "pdf")).toBe(false);
    });
  });

  describe("XLSX", () => {
    it("acepta buffer con firma ZIP/XLSX válida (PK\\x03\\x04)", () => {
      const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(validateFileMagicBytes(buf, "xlsx")).toBe(true);
    });

    it("rechaza buffer sin firma ZIP", () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(validateFileMagicBytes(buf, "xlsx")).toBe(false);
    });
  });

  describe("XLS", () => {
    it("acepta buffer con firma OLE2 válida (D0 CF 11 E0)", () => {
      const buf = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]);
      expect(validateFileMagicBytes(buf, "xls")).toBe(true);
    });

    it("rechaza buffer sin firma OLE2", () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(validateFileMagicBytes(buf, "xls")).toBe(false);
    });
  });

  it("rechaza buffer vacío para cualquier tipo", () => {
    const empty = Buffer.alloc(0);
    expect(validateFileMagicBytes(empty, "pdf")).toBe(false);
    expect(validateFileMagicBytes(empty, "xlsx")).toBe(false);
    expect(validateFileMagicBytes(empty, "xls")).toBe(false);
  });
});
