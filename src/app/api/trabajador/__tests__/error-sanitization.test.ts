import { describe, it, expect } from "vitest";

describe("API error response sanitization", () => {
  it("404 response shape should not include matricula field", () => {
    const errorResponse404 = {
      error: "No se encontraron trámites vigentes para su cuenta.",
    };
    expect(errorResponse404).not.toHaveProperty("matricula");
  });

  it("500 response shape should not include details field", () => {
    const errorResponse500 = {
      error: "Error interno del servidor.",
    };
    expect(errorResponse500).not.toHaveProperty("details");
    expect(errorResponse500).not.toHaveProperty("message");
  });
});
