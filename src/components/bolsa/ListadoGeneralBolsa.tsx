"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/firebase/firebase-client";

interface Fila {
  matricula: string;
  nombre: string;
  categoria: string;
  zona: string;
  posicionBase: number;
  totalEnCategoria: number;
  posicionInterinato: number | null;
  totalEventualesEnCategoria: number | null;
  tipoContratacion: string | null;
  adscripcionNueva: string | null;
  turnoNuevo: string | null;
}

type Contratacion = "TODOS" | "BASE" | "INTERINATO";

const PAGE_SIZE = 100;
const esInterino = (f: Fila) => f.tipoContratacion === "8";

function opciones(filas: Fila[], key: keyof Fila): string[] {
  return Array.from(
    new Set(filas.map((f) => (f[key] as string | null) || "").filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "es"));
}

function Filtro({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold normal-case tracking-normal text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
      >
        {children}
      </select>
    </label>
  );
}

/**
 * Listado general de un documento de bolsa: todos los trabajadores del
 * documento ordenados por posición dentro de su categoría, con filtros
 * (zona, categoría, turno, adscripción, base/interinato). Solo developer.
 */
export function ListadoGeneralBolsa({ documentoId }: { documentoId: string }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [zona, setZona] = useState("");
  const [categoria, setCategoria] = useState("");
  const [turno, setTurno] = useState("");
  const [adscripcion, setAdscripcion] = useState("");
  const [contratacion, setContratacion] = useState<Contratacion>("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(
          `/api/admin/bolsa/listados-generales?documentoId=${encodeURIComponent(documentoId)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Error de red");
        if (!cancelado) setFilas(json.data ?? []);
      } catch (e: any) {
        if (!cancelado) setError(e.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [documentoId]);

  // Filtros en cascada: cada selector solo ofrece opciones del alcance previo.
  const porZona = useMemo(
    () => (zona ? filas.filter((f) => f.zona === zona) : filas),
    [filas, zona],
  );
  const porCategoria = useMemo(
    () =>
      categoria ? porZona.filter((f) => f.categoria === categoria) : porZona,
    [porZona, categoria],
  );

  const resultado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = porCategoria.filter(
      (f) =>
        (!turno || f.turnoNuevo === turno) &&
        (!adscripcion || f.adscripcionNueva === adscripcion) &&
        (contratacion === "TODOS" ||
          (contratacion === "INTERINATO" ? esInterino(f) : !esInterino(f))) &&
        (!q ||
          f.matricula.toLowerCase().includes(q) ||
          f.nombre.toLowerCase().includes(q)),
    );
    const clave = (f: Fila) =>
      contratacion === "INTERINATO"
        ? (f.posicionInterinato ?? 0)
        : f.posicionBase;
    return lista.sort(
      (a, b) =>
        a.zona.localeCompare(b.zona) ||
        a.categoria.localeCompare(b.categoria) ||
        clave(a) - clave(b),
    );
  }, [porCategoria, turno, adscripcion, contratacion, busqueda]);

  useEffect(
    () => setPagina(0),
    [zona, categoria, turno, adscripcion, contratacion, busqueda],
  );

  const totalPaginas = Math.max(1, Math.ceil(resultado.length / PAGE_SIZE));
  const visibles = resultado.slice(
    pagina * PAGE_SIZE,
    (pagina + 1) * PAGE_SIZE,
  );
  const interinos = resultado.filter(esInterino).length;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Filtro
          label="Zona"
          value={zona}
          onChange={(v) => {
            setZona(v);
            setCategoria("");
          }}
        >
          <option value="">Todas</option>
          {opciones(filas, "zona").map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Filtro>
        <Filtro label="Categoría" value={categoria} onChange={setCategoria}>
          <option value="">Todas</option>
          {opciones(porZona, "categoria").map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Filtro>
        <Filtro label="Turno" value={turno} onChange={setTurno}>
          <option value="">Todos</option>
          {opciones(porCategoria, "turnoNuevo").map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Filtro>
        <Filtro
          label="Adscripción"
          value={adscripcion}
          onChange={setAdscripcion}
        >
          <option value="">Todas</option>
          {opciones(porCategoria, "adscripcionNueva").map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Filtro>
        <div className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
          Contratación
          <div className="flex h-10 gap-1">
            {(["TODOS", "BASE", "INTERINATO"] as Contratacion[]).map((c) => (
              <Button
                key={c}
                type="button"
                size="sm"
                variant={contratacion === c ? "default" : "outline"}
                className="h-10 flex-1 rounded-xl text-[10px] font-black uppercase"
                onClick={() => setContratacion(c)}
              >
                {c === "TODOS" ? "Todos" : c === "BASE" ? "Base" : "Interinato"}
              </Button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:col-span-2">
          Buscar
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Matrícula o nombre"
              className="h-10 rounded-xl pl-9 text-xs font-bold normal-case tracking-normal"
            />
          </div>
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs font-bold text-slate-500">
        {cargando
          ? "Cargando…"
          : `${resultado.length.toLocaleString("es-MX")} trabajadores · ${interinos.toLocaleString("es-MX")} interinos`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>
                {contratacion === "INTERINATO"
                  ? "Pos. interinato"
                  : "Pos. base"}
              </TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Adscripción</TableHead>
              <TableHead>Contr.</TableHead>
              {contratacion === "TODOS" && (
                <TableHead>Pos. interinato</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((f, i) => (
              <TableRow
                key={`${f.matricula}-${f.turnoNuevo}-${f.adscripcionNueva}-${i}`}
              >
                <TableCell className="font-mono font-bold">
                  {contratacion === "INTERINATO"
                    ? `${f.posicionInterinato ?? "—"} / ${f.totalEventualesEnCategoria ?? "—"}`
                    : `${f.posicionBase} / ${f.totalEnCategoria}`}
                </TableCell>
                <TableCell className="font-mono">{f.matricula}</TableCell>
                <TableCell>{f.nombre}</TableCell>
                <TableCell>{f.zona}</TableCell>
                <TableCell>{f.categoria}</TableCell>
                <TableCell>{f.turnoNuevo ?? "—"}</TableCell>
                <TableCell>{f.adscripcionNueva ?? "—"}</TableCell>
                <TableCell>{esInterino(f) ? "Interino" : "Base"}</TableCell>
                {contratacion === "TODOS" && (
                  <TableCell className="font-mono">
                    {f.posicionInterinato
                      ? `${f.posicionInterinato} / ${f.totalEventualesEnCategoria ?? "—"}`
                      : "—"}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <footer className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={pagina === 0}
          onClick={() => setPagina((p) => p - 1)}
        >
          Anterior
        </Button>
        <span className="text-xs font-bold text-slate-500">
          Página {pagina + 1} de {totalPaginas}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pagina + 1 >= totalPaginas}
          onClick={() => setPagina((p) => p + 1)}
        >
          Siguiente
        </Button>
      </footer>
    </div>
  );
}
