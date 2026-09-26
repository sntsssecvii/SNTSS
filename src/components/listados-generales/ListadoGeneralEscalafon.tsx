"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EscalafonAspirante,
  EscalafonPreferencia,
} from "@/types/escalafon";
import {
  Filtro,
  PAGE_SIZE,
  Paginador,
  Segmentado,
  opcionesUnicas,
} from "./controles";

type Estatus = "TODOS" | "Activo" | "PEI";

// SIAP escribe la zona incondicional de varias formas ("0 INCONDICIONA", etc.)
const esIncondicional = (zona: string) =>
  (zona ?? "").replace(/\s/g, "").toUpperCase().includes("INCONDICION");

/**
 * Listado general de un listado de escalafón. Con zona elegida ordena por el
 * ranking real de esa zona (Activo = promoción, PEI = definitiva); sin zona,
 * por lugar en el listado. Filtra por adscripción/turno de las preferencias.
 */
export function ListadoGeneralEscalafon({
  aspirantes,
  zonas,
}: {
  aspirantes: EscalafonAspirante[];
  zonas: string[];
}) {
  const [zona, setZona] = useState("");
  const [estatus, setEstatus] = useState<Estatus>("TODOS");
  const [adscripcion, setAdscripcion] = useState("");
  const [turno, setTurno] = useState("");
  const [delegacion, setDelegacion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);

  // Preferencias relevantes: las de la zona elegida (incluye incondicional).
  const prefsRelevantes = useMemo(
    () =>
      (a: EscalafonAspirante): EscalafonPreferencia[] =>
        zona
          ? (a.preferencias ?? []).filter(
              (p) => p.zonaSolicitada === zona || esIncondicional(p.zonaSolicitada),
            )
          : (a.preferencias ?? []),
    [zona],
  );

  const enZona = useMemo(
    () =>
      zona
        ? aspirantes.filter((a) => a.posicionesPorZona?.[zona] !== undefined)
        : aspirantes,
    [aspirantes, zona],
  );

  const rango = (a: EscalafonAspirante): number | undefined =>
    a.estatus === "Activo"
      ? a.posicionesActivoPorZona?.[zona]
      : a.posicionesPeiPorZona?.[zona];

  const totalesZona = useMemo(() => {
    const t = { Activo: 0, PEI: 0 };
    if (zona) for (const a of enZona) t[a.estatus] += 1;
    return t;
  }, [enZona, zona]);

  const opcAdscripcion = useMemo(
    () =>
      opcionesUnicas(
        enZona.flatMap((a) => prefsRelevantes(a).map((p) => p.adscripcionDesc)),
      ),
    [enZona, prefsRelevantes],
  );
  const opcTurno = useMemo(
    () =>
      opcionesUnicas(
        enZona.flatMap((a) => prefsRelevantes(a).map((p) => p.turnoDesc)),
      ),
    [enZona, prefsRelevantes],
  );
  const opcDelegacion = useMemo(
    () => opcionesUnicas(aspirantes.map((a) => a.delegacion)),
    [aspirantes],
  );

  const resultado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = enZona.filter(
      (a) =>
        (estatus === "TODOS" || a.estatus === estatus) &&
        (!delegacion || a.delegacion === delegacion) &&
        (!q ||
          a.matricula.toLowerCase().includes(q) ||
          a.nombre.toLowerCase().includes(q)) &&
        (!adscripcion && !turno
          ? true
          : prefsRelevantes(a).some(
              (p) =>
                (!adscripcion || p.adscripcionDesc === adscripcion) &&
                (!turno || p.turnoDesc === turno),
            )),
    );
    return lista.sort((a, b) =>
      zona
        ? (rango(a) ?? 9999) - (rango(b) ?? 9999) ||
          a.estatus.localeCompare(b.estatus)
        : a.lugar - b.lugar,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enZona, estatus, delegacion, busqueda, adscripcion, turno, zona, prefsRelevantes]);

  useEffect(
    () => setPagina(0),
    [zona, estatus, adscripcion, turno, delegacion, busqueda],
  );

  const visibles = resultado.slice(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Filtro
          label="Zona"
          value={zona}
          onChange={(v) => {
            setZona(v);
            setAdscripcion("");
            setTurno("");
          }}
        >
          <option value="">Todas (orden del listado)</option>
          {zonas.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Filtro>
        <Segmentado
          label="Estatus"
          value={estatus}
          onChange={setEstatus}
          opciones={[
            { valor: "TODOS", texto: "Todos" },
            { valor: "Activo", texto: "Activo" },
            { valor: "PEI", texto: "PEI" },
          ]}
        />
        <Filtro label="Adscripción" value={adscripcion} onChange={setAdscripcion}>
          <option value="">Todas</option>
          {opcAdscripcion.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Filtro>
        <Filtro label="Turno" value={turno} onChange={setTurno}>
          <option value="">Todos</option>
          {opcTurno.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Filtro>
        <Filtro label="Delegación" value={delegacion} onChange={setDelegacion}>
          <option value="">Todas</option>
          {opcDelegacion.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Filtro>
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

      <p className="text-xs font-bold text-slate-500">
        {resultado.length.toLocaleString("es-MX")} aspirantes
        {zona &&
          ` · ${totalesZona.Activo} activos (promoción) · ${totalesZona.PEI} PEI (definitiva) en la zona`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              {zona && <TableHead>Pos. en zona</TableHead>}
              <TableHead>Lugar</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Delegación</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Preferencias{zona ? " (zona)" : ""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((a) => {
              const prefs = prefsRelevantes(a);
              return (
                <TableRow key={a.id ?? `${a.matricula}-${a.lugar}`}>
                  {zona && (
                    <TableCell className="font-mono font-bold">
                      {rango(a) ?? "—"} / {totalesZona[a.estatus]}
                    </TableCell>
                  )}
                  <TableCell className="font-mono">{a.lugar}</TableCell>
                  <TableCell>
                    <Badge variant={a.estatus === "Activo" ? "default" : "secondary"}>
                      {a.estatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{a.matricula}</TableCell>
                  <TableCell>{a.nombre}</TableCell>
                  <TableCell>{a.delegacion}</TableCell>
                  <TableCell>{a.fechaRegistro}</TableCell>
                  <TableCell className="text-xs">
                    {prefs.length === 0
                      ? "—"
                      : prefs
                          .slice(0, 3)
                          .map((p) => `${p.adscripcionDesc} · ${p.turnoDesc}`)
                          .join(" | ") +
                        (prefs.length > 3 ? ` (+${prefs.length - 3})` : "")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Paginador pagina={pagina} total={resultado.length} onChange={setPagina} />
    </div>
  );
}
