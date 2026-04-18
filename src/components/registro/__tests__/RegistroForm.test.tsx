import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RegistroForm from "../RegistroForm";

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("../StepInfo", () => ({
  default: ({ onNext }: any) => (
    <button onClick={() => onNext({ nombre: "Test" })}>stepinfo</button>
  ),
}));

vi.mock("../StepDocs", () => ({
  default: () => <div>stepdocs</div>,
}));

vi.mock("../StepSuccess", () => ({
  default: () => <div>stepsuccess</div>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }: any) => <div {...p}>{children}</div>,
    p: ({ children, ...p }: any) => <p {...p}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("RegistroForm", () => {
  it("muestra el hero strip con la marca SNTSS", () => {
    render(<RegistroForm />);
    expect(screen.getByText("SNTSS · Sección VII")).toBeDefined();
  });

  it("muestra 'Datos personales' en el paso 1", () => {
    render(<RegistroForm />);
    expect(screen.getByText("Datos personales")).toBeDefined();
  });
});
