import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StepDocs from "../StepDocs";

vi.mock("@/lib/utils/image-optimization", () => ({
  optimizeImage: vi.fn((f: File) => Promise.resolve(f)),
}));

vi.mock("../DocumentScannerSheet", () => ({
  default: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }: any) => <div {...p}>{children}</div>,
    p: ({ children, ...p }: any) => <p {...p}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const defaultProps = {
  onBack: vi.fn(),
  onSubmit: vi.fn(),
  isSubmitting: false,
};

describe("StepDocs", () => {
  it("muestra las 3 tarjetas de documento", () => {
    render(<StepDocs {...defaultProps} />);
    expect(screen.getByText("Identificación Oficial (INE/IFE)")).toBeDefined();
    expect(screen.getByText("Tarjetón de Pago Reciente")).toBeDefined();
    expect(screen.getByText("Constancia de Afiliación Sindical")).toBeDefined();
  });

  it("botón Finalizar está desactivado sin archivos", () => {
    render(<StepDocs {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /finalizar registro/i });
    expect(btn).toHaveProperty("disabled", true);
  });

  it("muestra dos botones de acción por tarjeta vacía", () => {
    render(<StepDocs {...defaultProps} />);
    const escanearBtns = screen.getAllByRole("button", { name: /escanear/i });
    const archivoBtns = screen.getAllByRole("button", { name: /archivo/i });
    expect(escanearBtns).toHaveLength(3);
    expect(archivoBtns).toHaveLength(3);
  });
});
