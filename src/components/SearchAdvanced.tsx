"use client";

// TODO(feat/propuestas-admision): adaptar filtros al nuevo schema de Propuesta

import { useState } from "react";
import { Search, X, Filter } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CATEGORIAS_PROPUESTA } from "@/types/propuestas";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FiltrosBasicos {
  texto?: string;
  categoria?: string;
  fechaDesde?: Date;
  fechaHasta?: Date;
}

interface SearchAdvancedProps {
  onSearch: (filtros: FiltrosBasicos) => void;
  onClear: () => void;
  initialFilters?: FiltrosBasicos;
}

export function SearchAdvanced({
  onSearch,
  onClear,
  initialFilters,
}: SearchAdvancedProps) {
  const [filtros, setFiltros] = useState<FiltrosBasicos>(initialFilters || {});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = () => {
    onSearch(filtros);
  };

  const handleClear = () => {
    setFiltros({});
    onClear();
  };

  const activeFiltersCount = Object.values(filtros).filter(Boolean).length;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Búsqueda Avanzada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por matrícula, nombre..."
            value={filtros.texto || ""}
            onChange={(e) =>
              setFiltros((prev) => ({
                ...prev,
                texto: e.target.value || undefined,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1"
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
          {activeFiltersCount > 0 && (
            <Button variant="outline" onClick={handleClear}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full"
        >
          <Filter className="h-4 w-4 mr-2" />
          {showAdvanced ? "Ocultar" : "Mostrar"} Filtros Avanzados
        </Button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={filtros.categoria || ""}
                onChange={(e) =>
                  setFiltros((prev) => ({
                    ...prev,
                    categoria: e.target.value || undefined,
                  }))
                }
              >
                <option value="">Todas las categorías</option>
                {CATEGORIAS_PROPUESTA.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha desde</label>
              <Input
                type="date"
                value={
                  filtros.fechaDesde
                    ? format(filtros.fechaDesde, "yyyy-MM-dd")
                    : ""
                }
                onChange={(e) =>
                  setFiltros((prev) => ({
                    ...prev,
                    fechaDesde: e.target.value
                      ? new Date(e.target.value)
                      : undefined,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha hasta</label>
              <Input
                type="date"
                value={
                  filtros.fechaHasta
                    ? format(filtros.fechaHasta, "yyyy-MM-dd")
                    : ""
                }
                onChange={(e) =>
                  setFiltros((prev) => ({
                    ...prev,
                    fechaHasta: e.target.value
                      ? new Date(e.target.value)
                      : undefined,
                  }))
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
