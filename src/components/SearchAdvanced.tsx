'use client'

import { useState, useEffect } from 'react'
import { Search, X, Filter, Calendar, FileText, User, MapPin } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { CATEGORIAS_ARRAY } from '@/types/propuestas'
import type { FiltrosPropuesta } from '@/types/propuestas'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SearchAdvancedProps {
  onSearch: (filtros: FiltrosPropuesta) => void
  onClear: () => void
  initialFilters?: FiltrosPropuesta
}

export function SearchAdvanced({ onSearch, onClear, initialFilters }: SearchAdvancedProps) {
  const [filtros, setFiltros] = useState<FiltrosPropuesta>(initialFilters || {})
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSearch = () => {
    onSearch(filtros)
  }

  const handleClear = () => {
    setFiltros({})
    onClear()
  }

  const updateFilter = (key: keyof FiltrosPropuesta, value: any) => {
    setFiltros((prev) => ({
      ...prev,
      [key]: value || undefined,
    }))
  }

  const removeFilter = (key: keyof FiltrosPropuesta) => {
    setFiltros((prev) => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return newFilters
    })
  }

  const activeFiltersCount = Object.keys(filtros).filter(
    (key) => filtros[key as keyof FiltrosPropuesta]
  ).length

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Búsqueda Avanzada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Búsqueda rápida */}
        <div className="space-y-2">
          <Label>Búsqueda general</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nombre, matrícula, CURP, RFC..."
              value={filtros.trabajadorNombre || ''}
              onChange={(e) => {
                const value = e.target.value
                updateFilter('trabajadorNombre', value)
                updateFilter('trabajadorMatricula', value)
                updateFilter('aspiranteNombre', value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                }
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
        </div>

        {/* Filtros activos */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {filtros.categoria && (
              <Badge variant="secondary" className="gap-1">
                Categoría: {filtros.categoria}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('categoria')}
                />
              </Badge>
            )}
            {filtros.localidad && (
              <Badge variant="secondary" className="gap-1">
                Localidad: {filtros.localidad}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('localidad')}
                />
              </Badge>
            )}
            {filtros.fechaDesde && (
              <Badge variant="secondary" className="gap-1">
                Desde: {format(filtros.fechaDesde, 'dd/MM/yyyy', { locale: es })}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('fechaDesde')}
                />
              </Badge>
            )}
            {filtros.fechaHasta && (
              <Badge variant="secondary" className="gap-1">
                Hasta: {format(filtros.fechaHasta, 'dd/MM/yyyy', { locale: es })}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeFilter('fechaHasta')}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Botón para mostrar filtros avanzados */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full"
        >
          <Filter className="h-4 w-4 mr-2" />
          {showAdvanced ? 'Ocultar' : 'Mostrar'} Filtros Avanzados
        </Button>

        {/* Filtros avanzados */}
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="categoria">
                <FileText className="h-4 w-4 inline mr-1" />
                Categoría
              </Label>
              <Select
                id="categoria"
                value={filtros.categoria || ''}
                onChange={(e) => updateFilter('categoria', e.target.value || undefined)}
              >
                <option value="">Todas las categorías</option>
                {CATEGORIAS_ARRAY.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="localidad">
                <MapPin className="h-4 w-4 inline mr-1" />
                Localidad
              </Label>
              <Input
                id="localidad"
                placeholder="Filtrar por localidad"
                value={filtros.localidad || ''}
                onChange={(e) => updateFilter('localidad', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaDesde">
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha desde
              </Label>
              <Input
                id="fechaDesde"
                type="date"
                value={
                  filtros.fechaDesde
                    ? format(filtros.fechaDesde, 'yyyy-MM-dd')
                    : ''
                }
                onChange={(e) =>
                  updateFilter('fechaDesde', e.target.value ? new Date(e.target.value) : undefined)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaHasta">
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha hasta
              </Label>
              <Input
                id="fechaHasta"
                type="date"
                value={
                  filtros.fechaHasta
                    ? format(filtros.fechaHasta, 'yyyy-MM-dd')
                    : ''
                }
                onChange={(e) =>
                  updateFilter('fechaHasta', e.target.value ? new Date(e.target.value) : undefined)
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
