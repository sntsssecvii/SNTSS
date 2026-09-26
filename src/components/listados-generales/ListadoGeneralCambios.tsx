"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calcularPosicionesCambios } from "@/lib/cambios-escalafon/position-engine";
import type { CambiosRegistro } from "@/types/cambios-escalafon";
import {
  Filtro,
  PAGE_SIZE,
  Paginador,
  Segmentado,
  opcionesUnicas,
} from "./controles";

type Percibe = "TODOS" | "SI" | "NO";

/**
 * Listado general de un listado de cambios: cada grupo de competencia
 * (zona + unidad solicitada + turno; los incondicionales van aparte) con su
 * orden real de prelación, usando el mismo motor que el detalle del trabajador.
 */
export function ListadoGeneralCambios({
  registros,
}: {
  registros: CambiosRegistro[];
}) {
  const [zona, setZona] = useState("");
  const [unidad, setUnidad] = useState("");
  const [turno, setTurno] = useState("");
  const [tipo, setTipo] = useState("");
  const [percibe, setPercibe] = useState<Percibe>("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);

  const posiciones = useMemo(
    () => calcularPosicionesCambios(registros),
    [registros],
  );

  const porZona = useMemo(
    () => (zona ? posiciones.filter((p) => p.zona === zona) : posiciones),
    [posiciones, zona],
  );
  const porUnidad = useMemo(
    () => (unidad ? porZona.filter((p) => p.unidad === unidad) : porZona),
    [porZona, unidad],
  );

  const resultado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return porUnidad
      .filter(
        (p) =>
          (!turno || p.turno === turno) &&
          (!tipo || p.registro.tipo === tipo) &&
          (percibe === "TODOS" ||
            (p.registro.percibeConcepto ?? "").trim().toUpperCase().startsWith(
              percibe === "SI" ? "S" : "N",
            )) &&
          (!q ||
            p.registro.matricula.toLowerCase().includes(q) ||
            p.registro.nombre.toLowerCase().includes(q) ||
            p.registro.noSolicitud.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          a.zona.localeCompare(b.zona) ||
          a.unidad.localeCompare(b.unidad) ||
          a.turno.localeCompare(b.turno) ||
          a.lugar - b.lugar,
      );
  }, [porUnidad, turno, tipo, percibe, busqueda]);

  useEffect(
    () => setPagina(0),
    [zona, unidad, turno, tipo, percibe, busqueda],
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
            setUnidad("");
          }}
        >
          <option value="">Todas</option>
          {opcionesUnicas(posiciones.map((p) => p.zona)).map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Filtro>
        <Filtro label="Adscripción solicitada" value={unidad} onChange={setUnidad}>
          <option value="">Todas</option>
          {opcionesUnicas(porZona.map((p) => p.unidad)).map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Filtro>
        <Filtro label="Turno solicitado" value={turno} onChange={setTurno}>
          <option value="">Todos</option>
          {opcionesUnicas(porUnidad.map((p) => p.turno)).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Filtro>
        <Filtro label="Tipo de cambio" value={tipo} onChange={setTipo}>
          <option value="">Todos</option>
          {opcionesUnicas(porUnidad.map((p) => p.registro.tipo)).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Filtro>
        <Segmentado
          label="Percibe concepto"
          value={percibe}
          onChange={setPercibe}
          opciones={[
            { valor: "TODOS", texto: "Todos" },
            { valor: "SI", texto: "Sí" },
            { valor: "NO", texto: "No" },
          ]}
        />
        <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 sm:col-span-2 lg:col-span-3">
          Buscar
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Matrícula, nombre o no. de solicitud"
              className="h-10 rounded-xl pl-9 text-xs font-bold normal-case tracking-normal"
            />
          </div>
        </label>
      </section>

      <p className="text-xs font-bold text-slate-500">
        {resultado.length.toLocaleString("es-MX")} registros
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead>Lugar en grupo</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Adscripción solicitada</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Percibe</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>No. solicitud</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((p, i) => (
              <TableRow key={p.registro.id ?? `${p.registro.noSolicitud}-${i}`}>
                <TableCell className="font-mono font-bold">
                  {p.lugar} / {p.totalEnGrupo}
                </TableCell>
                <TableCell>{p.zona}</TableCell>
                <TableCell>{p.unidad}</TableCell>
                <TableCell>{p.turno}</TableCell>
                <TableCell className="font-mono">{p.registro.matricula}</TableCell>
                <TableCell>{p.registro.nombre}</TableCell>
                <TableCell>{p.registro.tipo}</TableCell>
                <TableCell>{p.registro.percibeConcepto || "—"}</TableCell>
                <TableCell className="text-xs">
                  {p.registro.fechaRegistro} {p.registro.horaRegistro}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {p.registro.noSolicitud}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Paginador pagina={pagina} total={resultado.length} onChange={setPagina} />
    </div>
  );
}
