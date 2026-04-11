const MAGIC_BYTES: Record<"pdf" | "xlsx" | "xls", number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  xlsx: [0x50, 0x4b, 0x03, 0x04], // PK\x03\x04 (ZIP — base de XLSX)
  xls: [0xd0, 0xcf, 0x11, 0xe0], // OLE2 — formato legacy de Excel
};

export function validateFileMagicBytes(
  buffer: Buffer,
  expectedType: "pdf" | "xlsx" | "xls",
): boolean {
  const signature = MAGIC_BYTES[expectedType];
  if (buffer.length < signature.length) return false;
  return signature.every((byte, i) => buffer[i] === byte);
}
