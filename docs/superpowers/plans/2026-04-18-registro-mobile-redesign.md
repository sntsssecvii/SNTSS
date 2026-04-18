# Registro Mobile-First Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el flujo de registro (4 componentes) para que sea mobile-first, premium, light-only — sin tocar lógica de negocio, validaciones, Firebase ni el pipeline de archivos.

**Architecture:** Cada componente se reescribe en JSX/CSS solamente. `RegistroForm` recibe un hero compacto (~64px) con gradiente rojo y slide-transition horizontal entre pasos. `StepInfo` usa inputs touch-friendly (h-12) y botón full-width. `StepDocs` reemplaza `FileCard` con `DocCard` numerado con dos botones de acción visibles. `StepSuccess` limpia clases dark:.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, Framer Motion, @testing-library/react, Vitest (jsdom)

---

## File Map

| Archivo                                                   | Acción | Responsabilidad                                    |
| --------------------------------------------------------- | ------ | -------------------------------------------------- |
| `src/components/registro/RegistroForm.tsx`                | Modify | Hero compacto, slide transition, sin dark:         |
| `src/components/registro/StepInfo.tsx`                    | Modify | Inputs h-12, botón full-width, sin motion propio   |
| `src/components/registro/StepDocs.tsx`                    | Modify | DocCard: tarjetas numeradas con Escanear + Archivo |
| `src/components/registro/StepSuccess.tsx`                 | Modify | Eliminar dark: classes, ajustar padding            |
| `src/components/registro/__tests__/RegistroForm.test.tsx` | Create | Hero strip rendered, title changes per step        |
| `src/components/registro/__tests__/StepDocs.test.tsx`     | Create | Finalizar disabled logic                           |

---

## Task 1: RegistroForm — Hero compacto + slide transition

**Files:**

- Modify: `src/components/registro/RegistroForm.tsx`
- Create: `src/components/registro/__tests__/RegistroForm.test.tsx`

- [ ] **Step 1: Escribir test que falla**

Crear `src/components/registro/__tests__/RegistroForm.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Correr test para verificar que falla**

```bash
npm test -- src/components/registro/__tests__/RegistroForm.test.tsx
```

Resultado esperado: FAIL — `RegistroForm` no tiene el hero strip.

- [ ] **Step 3: Reemplazar RegistroForm.tsx**

Reemplazar el contenido completo de `src/components/registro/RegistroForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import StepInfo from "./StepInfo";
import StepDocs from "./StepDocs";
import StepSuccess from "./StepSuccess";
import type { RegistroFormData } from "@/lib/schemas/registro";

export default function RegistroForm() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState<Partial<RegistroFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInfoSubmit = (data: Partial<RegistroFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setDirection(1);
    setStep(2);
  };

  const handleBack = () => {
    setDirection(-1);
    setStep(1);
  };

  const handleDocsSubmit = async (files: {
    identificacion: File;
    tarjeton: File;
    constanciaAfiliacion: File;
  }) => {
    if (!formData.email || !formData.password || !formData.matricula) {
      toast({
        title: "Error de datos",
        description: "Falta información del paso anterior.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.set("nombre", formData.nombre || "");
      payload.set("apellidoPaterno", formData.apellidoPaterno || "");
      payload.set("apellidoMaterno", formData.apellidoMaterno || "");
      payload.set("matricula", formData.matricula || "");
      payload.set("email", formData.email || "");
      payload.set("password", formData.password || "");
      payload.set("confirmPassword", formData.confirmPassword || "");
      payload.set("identificacion", files.identificacion);
      payload.set("tarjeton", files.tarjeton);
      payload.set("constanciaAfiliacion", files.constanciaAfiliacion);

      const response = await fetch("/api/registro", {
        method: "POST",
        body: payload,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Ocurrió un error inesperado.");
      }

      toast({
        title: "Registro Exitoso",
        description:
          result?.warning || "Tu solicitud ha sido enviada para validación.",
      });

      setDirection(1);
      setStep(3);
    } catch (error: any) {
      toast({
        title: "Error al registrar",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const heroTitle =
    step === 1
      ? "Datos personales"
      : step === 2
        ? "Documentos requeridos"
        : "Registro completado";

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
      {/* Hero compacto */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, #CC1B1B 0%, #7F0000 100%)",
        }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
            SNTSS · Sección VII
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-sm font-bold text-white"
            >
              {heroTitle}
            </motion.p>
          </AnimatePresence>
        </div>
        {step <= 2 && (
          <div className="flex gap-1 flex-shrink-0">
            {[1, 2].map((s) => (
              <motion.div
                key={s}
                className="h-0.5 w-5 rounded-full"
                animate={{
                  backgroundColor:
                    step >= s ? "#ffffff" : "rgba(255,255,255,0.3)",
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contenido del paso */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ x: direction * 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -40, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {step === 1 ? (
            <StepInfo onNext={handleInfoSubmit} initialData={formData} />
          ) : step === 2 ? (
            <StepDocs
              onBack={handleBack}
              onSubmit={handleDocsSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <StepSuccess />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Correr test para verificar que pasa**

```bash
npm test -- src/components/registro/__tests__/RegistroForm.test.tsx
```

Resultado esperado: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/registro/RegistroForm.tsx src/components/registro/__tests__/RegistroForm.test.tsx
git commit -m "feat(registro): hero compacto + slide transition en RegistroForm"
```

---

## Task 2: StepInfo — Inputs touch-friendly + botón full-width

**Files:**

- Modify: `src/components/registro/StepInfo.tsx`

StepInfo no tiene clases dark:. Los cambios son: (1) eliminar la transición propia del `motion.form` (ya la maneja el padre), (2) inputs h-12 con padding cómodo, (3) botón full-width h-12, (4) agregar padding lateral al layout.

- [ ] **Step 1: Reemplazar StepInfo.tsx**

Reemplazar el contenido completo de `src/components/registro/StepInfo.tsx`:

```tsx
"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  registroBaseSchema,
  type RegistroFormData,
} from "@/lib/schemas/registro";
import {
  evaluarFortalezaPassword,
  passwordsCoinciden,
} from "@/lib/utils/password";
import { toTitleCase } from "@/lib/utils/text";
import { Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

interface StepInfoProps {
  onNext: (data: Partial<RegistroFormData>) => void;
  initialData?: Partial<RegistroFormData>;
}

const stepInfoSchema = registroBaseSchema
  .pick({
    nombre: true,
    apellidoPaterno: true,
    apellidoMaterno: true,
    matricula: true,
    email: true,
    password: true,
    confirmPassword: true,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

const inputCls =
  "h-12 text-base transition-all focus:ring-2 focus:ring-red-500/20 focus:border-red-500";

export default function StepInfo({ onNext, initialData }: StepInfoProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof stepInfoSchema>>({
    resolver: zodResolver(stepInfoSchema),
    defaultValues: initialData,
  });

  const [sinApellidoMaterno, setSinApellidoMaterno] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");

  const passwordStrength = password ? evaluarFortalezaPassword(password) : null;
  const passwordMatch =
    confirmPassword && password
      ? passwordsCoinciden(password, confirmPassword)
      : null;

  const onSubmit = (data: z.infer<typeof stepInfoSchema>) => {
    onNext(data);
  };

  return (
    <form className="px-5 py-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre(s)</Label>
          <Input
            id="nombre"
            placeholder="Ej. Juan Carlos"
            {...register("nombre", {
              onBlur: (e) => {
                if (e.target.value)
                  setValue("nombre", toTitleCase(e.target.value));
              },
            })}
            className={inputCls}
          />
          {errors.nombre && (
            <p className="text-xs text-red-500">{errors.nombre.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apellidoPaterno">Apellido Paterno</Label>
          <Input
            id="apellidoPaterno"
            placeholder="Ej. Pérez"
            {...register("apellidoPaterno", {
              onBlur: (e) => {
                if (e.target.value)
                  setValue("apellidoPaterno", toTitleCase(e.target.value));
              },
            })}
            className={inputCls}
          />
          {errors.apellidoPaterno && (
            <p className="text-xs text-red-500">
              {errors.apellidoPaterno.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
        <Input
          id="apellidoMaterno"
          placeholder="Ej. López"
          disabled={sinApellidoMaterno}
          {...register("apellidoMaterno", {
            onBlur: (e) => {
              if (!sinApellidoMaterno && e.target.value)
                setValue("apellidoMaterno", toTitleCase(e.target.value));
            },
          })}
          className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
        />
        <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
          <input
            type="checkbox"
            checked={sinApellidoMaterno}
            onChange={(e) => {
              setSinApellidoMaterno(e.target.checked);
              if (e.target.checked) setValue("apellidoMaterno", "");
            }}
            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-slate-500">
            No tengo apellido materno
          </span>
        </label>
        {errors.apellidoMaterno && (
          <p className="text-xs text-red-500">
            {errors.apellidoMaterno.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="matricula">Matrícula</Label>
        <Input
          id="matricula"
          placeholder="Máximo 10 dígitos numéricos"
          maxLength={10}
          {...register("matricula")}
          className={inputCls}
        />
        {errors.matricula && (
          <p className="text-xs text-red-500">{errors.matricula.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo Electrónico</Label>
        <Input
          id="email"
          type="email"
          placeholder="nombre@ejemplo.com"
          {...register("email")}
          className={inputCls}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Mínimo 8 caracteres"
            {...register("password")}
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
        {passwordStrength && (
          <div className="space-y-1.5 mt-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(passwordStrength.score + 1) * 25}%` }}
                  className={`h-full ${passwordStrength.color} transition-all duration-300`}
                />
              </div>
              <span className="text-xs font-medium text-slate-600 shrink-0">
                {passwordStrength.label}
              </span>
            </div>
            {passwordStrength.suggestions.length > 0 && (
              <div className="text-xs text-slate-400 space-y-0.5">
                {passwordStrength.suggestions.map((s, i) => (
                  <p key={i}>• {s}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Repite tu contraseña"
            {...register("confirmPassword")}
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showConfirmPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-red-500">
            {errors.confirmPassword.message}
          </p>
        )}
        {confirmPassword && (
          <div
            className={`text-xs flex items-center gap-1 mt-1 ${
              passwordMatch ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {passwordMatch ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Las contraseñas coinciden
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                Las contraseñas no coinciden
              </>
            )}
          </div>
        )}
      </div>

      <div className="pt-1">
        <Button
          type="submit"
          className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
        >
          Continuar →
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Correr typecheck**

```bash
npm run typecheck 2>&1 | head -30
```

Resultado esperado: sin errores en StepInfo.

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/StepInfo.tsx
git commit -m "feat(registro): inputs touch-friendly h-12 y CTA full-width en StepInfo"
```

---

## Task 3: StepDocs — DocCard numerado con acciones visibles

**Files:**

- Modify: `src/components/registro/StepDocs.tsx`
- Create: `src/components/registro/__tests__/StepDocs.test.tsx`

- [ ] **Step 1: Escribir test que falla**

Crear `src/components/registro/__tests__/StepDocs.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Correr test para verificar que falla**

```bash
npm test -- src/components/registro/__tests__/StepDocs.test.tsx
```

Resultado esperado: FAIL — el componente actual no tiene DocCard con estas clases.

- [ ] **Step 3: Reemplazar StepDocs.tsx**

Reemplazar el contenido completo de `src/components/registro/StepDocs.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, ScanLine } from "lucide-react";
import { optimizeImage } from "@/lib/utils/image-optimization";
import { cn } from "@/lib/utils";
import DocumentScannerSheet from "./DocumentScannerSheet";

interface StepDocsProps {
  onBack: () => void;
  onSubmit: (files: {
    identificacion: File;
    tarjeton: File;
    constanciaAfiliacion: File;
  }) => void;
  isSubmitting: boolean;
}

const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_REGISTRATION_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

type DocType = "identificacion" | "tarjeton" | "constanciaAfiliacion";

interface DocCardProps {
  index: number;
  label: string;
  file: File | null;
  type: DocType;
  inputRef: React.RefObject<HTMLInputElement>;
  error?: string;
  isProcessing: boolean;
  onScan: () => void;
  onFileClick: () => void;
  onClear: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, type: DocType) => void;
}

function DocCard({
  index,
  label,
  file,
  type,
  inputRef,
  error,
  isProcessing,
  onScan,
  onFileClick,
  onClear,
  onFileChange,
}: DocCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors duration-200",
        error
          ? "border-red-300 bg-red-50/40"
          : file
            ? "border-emerald-400 bg-emerald-50/30"
            : "border-slate-200 bg-white",
      )}
    >
      <input
        type="file"
        ref={inputRef}
        onChange={(e) => onFileChange(e, type)}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf"
      />

      {isProcessing ? (
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-red-600 border-t-transparent animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Procesando...
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        </div>
      ) : file ? (
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-slate-400 hover:text-red-500 flex-shrink-0 text-xs"
          >
            Cambiar
          </Button>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{index}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                JPG, PNG, HEIC o PDF
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={onScan}
              className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold gap-1.5"
            >
              <ScanLine className="w-3.5 h-3.5" />
              Escanear
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onFileClick}
              className="flex-1 h-9 border-slate-200 text-slate-600 text-xs font-medium gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Archivo
            </Button>
          </div>
        </div>
      )}

      {error && (
        <AnimatePresence>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pb-3 text-xs text-red-500 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" />
            {error}
          </motion.p>
        </AnimatePresence>
      )}
    </div>
  );
}

export default function StepDocs({
  onBack,
  onSubmit,
  isSubmitting,
}: StepDocsProps) {
  const [identificacion, setIdentificacion] = useState<File | null>(null);
  const [tarjeton, setTarjeton] = useState<File | null>(null);
  const [constanciaAfiliacion, setConstanciaAfiliacion] = useState<File | null>(
    null,
  );
  const [errors, setErrors] = useState<Partial<Record<DocType, string>>>({});
  const [processing, setProcessing] = useState<
    Partial<Record<DocType, boolean>>
  >({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<{
    type: DocType;
    label: string;
  } | null>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const tarjetonInputRef = useRef<HTMLInputElement>(null);
  const constanciaInputRef = useRef<HTMLInputElement>(null);

  const setFile = (type: DocType, file: File | null) => {
    if (type === "identificacion") setIdentificacion(file);
    else if (type === "tarjeton") setTarjeton(file);
    else setConstanciaAfiliacion(file);
  };

  const getInputRef = (type: DocType) => {
    if (type === "identificacion") return idInputRef;
    if (type === "tarjeton") return tarjetonInputRef;
    return constanciaInputRef;
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: DocType,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isHeicByExtension =
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");
    const isAllowed =
      ALLOWED_REGISTRATION_FILE_TYPES.includes(file.type) || isHeicByExtension;

    if (!isAllowed) {
      setErrors((prev) => ({
        ...prev,
        [type]: "Solo se aceptan imágenes JPG, PNG, HEIC o archivos PDF.",
      }));
      return;
    }

    const maxSize =
      file.type === "application/pdf"
        ? MAX_PDF_FILE_SIZE_BYTES
        : MAX_IMAGE_FILE_SIZE_BYTES;

    if (file.size <= 0 || file.size > maxSize) {
      const limitLabel = file.type === "application/pdf" ? "5 MB" : "20 MB";
      setErrors((prev) => ({
        ...prev,
        [type]: `El archivo es demasiado grande. Máximo ${limitLabel}.`,
      }));
      return;
    }

    setProcessing((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: undefined }));

    try {
      let finalFile = file;
      if (file.type.startsWith("image/")) {
        finalFile = await optimizeImage(file);
      }
      setFile(type, finalFile);
    } catch {
      setErrors((prev) => ({
        ...prev,
        [type]: "Error al procesar el archivo",
      }));
    } finally {
      setProcessing((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleScanCapture = async (file: File) => {
    if (!scannerTarget) return;
    const { type } = scannerTarget;

    setProcessing((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: undefined }));

    try {
      const optimized = await optimizeImage(file);
      setFile(type, optimized);
    } catch {
      setFile(type, file);
    } finally {
      setProcessing((prev) => ({ ...prev, [type]: false }));
      setScannerOpen(false);
      setScannerTarget(null);
    }
  };

  const handleSubmit = () => {
    const newErrors: Partial<Record<DocType, string>> = {};
    if (!identificacion)
      newErrors.identificacion = "Debes subir tu identificación";
    if (!tarjeton) newErrors.tarjeton = "Debes subir tu tarjetón de pago";
    if (!constanciaAfiliacion)
      newErrors.constanciaAfiliacion =
        "Debes subir tu constancia de afiliación";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (identificacion && tarjeton && constanciaAfiliacion) {
      onSubmit({ identificacion, tarjeton, constanciaAfiliacion });
    }
  };

  const allReady = !!(identificacion && tarjeton && constanciaAfiliacion);
  const anyProcessing = !!(
    processing.identificacion ||
    processing.tarjeton ||
    processing.constanciaAfiliacion
  );

  return (
    <>
      <div className="px-5 py-6 space-y-3">
        <DocCard
          index={1}
          label="Identificación Oficial (INE/IFE)"
          type="identificacion"
          file={identificacion}
          inputRef={idInputRef}
          error={errors.identificacion}
          isProcessing={processing.identificacion || false}
          onScan={() => {
            setScannerTarget({
              type: "identificacion",
              label: "Identificación Oficial (INE/IFE)",
            });
            setScannerOpen(true);
          }}
          onFileClick={() => idInputRef.current?.click()}
          onClear={() => {
            setIdentificacion(null);
            if (idInputRef.current) idInputRef.current.value = "";
          }}
          onFileChange={handleFileChange}
        />
        <DocCard
          index={2}
          label="Tarjetón de Pago Reciente"
          type="tarjeton"
          file={tarjeton}
          inputRef={tarjetonInputRef}
          error={errors.tarjeton}
          isProcessing={processing.tarjeton || false}
          onScan={() => {
            setScannerTarget({
              type: "tarjeton",
              label: "Tarjetón de Pago Reciente",
            });
            setScannerOpen(true);
          }}
          onFileClick={() => tarjetonInputRef.current?.click()}
          onClear={() => {
            setTarjeton(null);
            if (tarjetonInputRef.current) tarjetonInputRef.current.value = "";
          }}
          onFileChange={handleFileChange}
        />
        <DocCard
          index={3}
          label="Constancia de Afiliación Sindical"
          type="constanciaAfiliacion"
          file={constanciaAfiliacion}
          inputRef={constanciaInputRef}
          error={errors.constanciaAfiliacion}
          isProcessing={processing.constanciaAfiliacion || false}
          onScan={() => {
            setScannerTarget({
              type: "constanciaAfiliacion",
              label: "Constancia de Afiliación Sindical",
            });
            setScannerOpen(true);
          }}
          onFileClick={() => constanciaInputRef.current?.click()}
          onClear={() => {
            setConstanciaAfiliacion(null);
            if (constanciaInputRef.current)
              constanciaInputRef.current.value = "";
          }}
          onFileChange={handleFileChange}
        />

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="border-slate-200 text-slate-600 h-12 px-5"
          >
            Atrás
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !allReady || anyProcessing}
            className="flex-1 h-12 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold rounded-xl"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              "Finalizar registro"
            )}
          </Button>
        </div>
      </div>

      {scannerOpen && (
        <DocumentScannerSheet
          open={scannerOpen}
          onClose={() => {
            setScannerOpen(false);
            setScannerTarget(null);
          }}
          onCapture={handleScanCapture}
          documentLabel={scannerTarget?.label ?? "Documento"}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Correr tests**

```bash
npm test -- src/components/registro/__tests__/StepDocs.test.tsx
```

Resultado esperado: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/registro/StepDocs.tsx src/components/registro/__tests__/StepDocs.test.tsx
git commit -m "feat(registro): DocCard numerado con Escanear+Archivo en StepDocs"
```

---

## Task 4: StepSuccess — Eliminar dark: classes

**Files:**

- Modify: `src/components/registro/StepSuccess.tsx`

- [ ] **Step 1: Reemplazar StepSuccess.tsx**

Reemplazar el contenido completo de `src/components/registro/StepSuccess.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function StepSuccess() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-8 px-5 py-8"
    >
      {/* Ícono animado */}
      <div className="relative flex justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.2,
          }}
          className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center relative z-10"
        >
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-green-400/20 rounded-full"
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-extrabold text-slate-900">
          ¡Registro Recibido!
        </h2>
        <p className="text-slate-500 max-w-sm mx-auto">
          Tu solicitud ha sido enviada con éxito al sistema de validación del
          SNTSS.
        </p>
      </div>

      {/* Timeline del proceso */}
      <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-5 border border-slate-100">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm">
              Validación de Identidad
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Nuestro equipo administrativo verificará tus documentos y
              matrícula.
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm">
              Notificación por Email
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Recibirás un correo electrónico en cuanto tu cuenta sea activada.
            </p>
          </div>
        </div>
      </div>

      <div>
        <Button
          onClick={() => router.push("/login")}
          className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-500/20 group"
        >
          Entendido, ir al Login
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
        Sindicato Nacional de Trabajadores del Seguro Social
      </p>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verificar que no quedan clases dark:**

```bash
grep -n "dark:" src/components/registro/StepSuccess.tsx src/components/registro/StepInfo.tsx src/components/registro/StepDocs.tsx src/components/registro/RegistroForm.tsx
```

Resultado esperado: sin output (ningún match).

- [ ] **Step 3: Commit**

```bash
git add src/components/registro/StepSuccess.tsx
git commit -m "feat(registro): eliminar dark: classes en StepSuccess"
```

---

## Task 5: Validación final

- [ ] **Step 1: Correr todos los tests nuevos**

```bash
npm test -- src/components/registro/__tests__/
```

Resultado esperado: PASS (5 tests total).

- [ ] **Step 2: Correr typecheck y lint**

```bash
npm run check
```

Resultado esperado: sin errores de TypeScript ni ESLint.

- [ ] **Step 3: Verificar build**

```bash
npm run build 2>&1 | tail -20
```

Resultado esperado: ✓ Compiled successfully.

- [ ] **Step 4: Smoke test manual en móvil**

Abrir `http://localhost:3000/registro` en DevTools con viewport iPhone SE (375×667):

1. ✓ Hero rojo compacto visible arriba con "SNTSS · Sección VII" y "Datos personales"
2. ✓ Inputs tienen altura cómoda (h-12), se pueden tocar fácilmente
3. ✓ Botón "Continuar →" ancho completo al final del formulario
4. ✓ Al avanzar al paso 2: hero cambia a "Documentos requeridos", ambas barras blancas activas
5. ✓ Las 3 tarjetas muestran número rojo, nombre y dos botones (Escanear / Archivo)
6. ✓ "Finalizar registro" aparece en gris (deshabilitado) hasta subir los 3 docs
7. ✓ Al subir un doc: tarjeta cambia a borde verde, muestra nombre del archivo y "Cambiar"
8. ✓ Al completar los 3 docs: "Finalizar registro" se activa en rojo

- [ ] **Step 5: Commit final si todo ok**

```bash
git add -A
git commit -m "feat(registro): rediseño mobile-first completo — light-only, hero compacto, DocCards"
```
