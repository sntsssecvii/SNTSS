'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, Download, Search, ChevronLeft, ChevronRight, XCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getEscalafonDocumentoById, validarRegistro } from '@/lib/firebase/escalafon'
import type { EscalafonDocumento, EscalafonRegistro } from '@/types/escalafon'
import { NOMBRES_TIPOS } from '@/types/escalafon'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { EstadoBadgeEscalafon } from '@/components/escalafon/EstadoBadgeEscalafon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'

export default function DetalleEscalafonPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [documento, setDocumento] = useState<EscalafonDocumento | null>(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroValidacion, setFiltroValidacion] = useState<'all' | 'validados' | 'pendientes'>('all')

  // Filtros adicionales
  const [filtroZona, setFiltroZona] = useState<string>('all')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(50)

  // Modal de detalles
  const [registroSeleccionado, setRegistroSeleccionado] = useState<EscalafonRegistro | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => {
    if (params.id) {
      cargarDocumento(params.id as string)
    }
  }, [params.id])

  const cargarDocumento = async (id: string) => {
    try {
      setLoading(true)
      const doc = await getEscalafonDocumentoById(id)
      setDocumento(doc)
    } catch (error: any) {
      console.error('Error cargando documento:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar el documento',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleValidar = async (registroId: string) => {
    if (!user?.uid || !documento?.id) return

    try {
      await validarRegistro(documento.id, registroId, user.uid)
      toast({
        title: 'Éxito',
        description: 'Registro validado correctamente',
      })
      cargarDocumento(documento.id)
    } catch (error: any) {
      console.error('Error validando registro:', error)
      toast({
        title: 'Error',
        description: 'No se pudo validar el registro',
        variant: 'destructive',
      })
    }
  }

  // Función para normalizar strings (eliminar espacios extra, normalizar, eliminar caracteres especiales)
  const normalizarString = (str: string | undefined): string => {
    if (!str) return ''
    return str
      .trim()
      .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
      .replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales excepto guiones
      .toLowerCase()
  }

  // Obtener valores únicos para los filtros
  const zonasUnicas = useMemo(() => {
    if (!documento) return []
    const zonas = new Set(documento.registros.map(r => r.zona).filter(Boolean))
    return Array.from(zonas).sort()
  }, [documento])

  const categoriasUnicas = useMemo(() => {
    if (!documento) return []

    // Normalizar y agrupar categorías similares de manera más agresiva
    const categoriasMap = new Map<string, string>() // clave normalizada -> valor original
    const categoriasVistas = new Set<string>() // Para evitar duplicados exactos

    documento.registros.forEach(reg => {
      if (reg.categoria) {
        const categoria = reg.categoria.trim()

        // Evitar duplicados exactos
        if (categoriasVistas.has(categoria)) {
          return
        }
        categoriasVistas.add(categoria)

        // Normalizar para comparación
        const normalizada = normalizarString(categoria)

        // Buscar si ya existe una categoría similar (normalizada)
        if (!categoriasMap.has(normalizada)) {
          categoriasMap.set(normalizada, categoria)
        } else {
          // Si existe, mantener la versión más completa
          const existente = categoriasMap.get(normalizada)!
          if (categoria.length > existente.length) {
            categoriasMap.set(normalizada, categoria)
          }
        }
      }
    })

    return Array.from(categoriasMap.values()).sort()
  }, [documento])

  // Estado para búsqueda de categoría
  const [busquedaCategoria, setBusquedaCategoria] = useState('')
  const [mostrarDropdownCategoria, setMostrarDropdownCategoria] = useState(false)

  // Categorías filtradas por búsqueda
  const categoriasFiltradas = useMemo(() => {
    if (!busquedaCategoria) return categoriasUnicas
    const busquedaLower = busquedaCategoria.toLowerCase()
    return categoriasUnicas.filter(cat =>
      cat.toLowerCase().includes(busquedaLower)
    )
  }, [categoriasUnicas, busquedaCategoria])

  // Filtrar registros
  const registrosFiltrados = useMemo(() => {
    if (!documento) return []

    return documento.registros.filter((reg) => {
      // Filtro de búsqueda
      if (busqueda) {
        const busquedaLower = busqueda.toLowerCase()
        const coincide =
          reg.nombre?.toLowerCase().includes(busquedaLower) ||
          reg.matricula?.includes(busqueda) ||
          reg.numeroProg?.includes(busqueda) ||
          reg.grupo?.includes(busqueda) ||
          reg.clave?.toLowerCase().includes(busquedaLower) ||
          reg.adscripcion?.toLowerCase().includes(busquedaLower) ||
          reg.zona?.toLowerCase().includes(busquedaLower) ||
          reg.categoria?.toLowerCase().includes(busquedaLower)
        if (!coincide) return false
      }

      // Filtro de validación
      if (filtroValidacion === 'validados') {
        if (reg.validado !== true) return false
      }
      if (filtroValidacion === 'pendientes') {
        if (reg.validado && !reg.necesitaValidacion) return false
      }

      // Filtro de zona
      if (filtroZona !== 'all' && reg.zona !== filtroZona) {
        return false
      }

      // Filtro de categoría (comparar normalizado)
      if (filtroCategoria !== 'all') {
        const categoriaNormalizada = normalizarString(reg.categoria)
        const filtroNormalizado = normalizarString(filtroCategoria)
        if (categoriaNormalizada !== filtroNormalizado) {
          return false
        }
      }

      return true
    })
  }, [documento, busqueda, filtroValidacion, filtroZona, filtroCategoria])

  // Paginación
  const totalPaginas = Math.ceil(registrosFiltrados.length / registrosPorPagina)
  const indiceInicio = (paginaActual - 1) * registrosPorPagina
  const indiceFin = indiceInicio + registrosPorPagina
  const registrosPaginated = registrosFiltrados.slice(indiceInicio, indiceFin)

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setPaginaActual(1)
  }, [busqueda, filtroValidacion, filtroZona, filtroCategoria])

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.categoria-filter-container')) {
        setMostrarDropdownCategoria(false)
      }
    }

    if (mostrarDropdownCategoria) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [mostrarDropdownCategoria])

  const abrirModalDetalle = (registro: EscalafonRegistro) => {
    setRegistroSeleccionado(registro)
    setModalAbierto(true)
  }

  const exportarCSV = () => {
    if (!documento) return

    const esNuevoIngreso = documento.tipo === 'NUEVO_INGRESO'
    const esAmpliacion = documento.tipo === 'AMPLIACIONES_JORNADA'

    const headers = esNuevoIngreso
      ? ['No. Prog', 'Nombre', 'Matrícula', 'Fecha de Registro', 'Grupo', 'Calificación', 'Tipo de Contratación', 'Días Laborados', 'Estatus', 'Observaciones', 'Zona', 'Categoría']
      : esAmpliacion
        ? ['No. Prog', 'Jornada Actual', 'Adscripción Actual (Clave)', 'Turno Actual', 'Fecha Registro', 'Estatus', 'Días Laborados', 'Matrícula', 'Nombre', 'Sexo', 'Nueva Adscripción (Clave)', 'Nueva Adscripción (Nombre)', 'No. Plaza', 'Nueva Jornada', 'Nuevo Turno', 'Zona', 'Categoría']
        : ['Nombre', 'Matrícula', 'Fecha', 'Registro', 'Clave', 'Adscripción', 'Zona', 'Categoría']

    const rows = registrosFiltrados.map((reg) => {
      if (documento.tipo === 'NUEVO_INGRESO') {
        return [
          reg.numeroProg || '',
          reg.nombre || '',
          reg.matricula || '',
          reg.fecha || '',
          reg.grupo || '',
          reg.calificacion || '',
          reg.tipoContratacion || '',
          reg.diasLaborados || '',
          reg.estatus || '',
          reg.observaciones || '',
          reg.zona || '',
          reg.categoria || '',
        ]
      } else if (documento.tipo === 'AMPLIACIONES_JORNADA') {
        return [
          reg.numeroProg || '',
          reg.jornadaActual || '',
          reg.adscripcionActualClave || '',
          reg.turnoActual || '',
          reg.fecha || '',
          reg.estatus || '',
          reg.diasLaborados || '',
          reg.matricula || '',
          reg.nombre || '',
          reg.sexo || '',
          reg.adscripcionNuevaClave || '',
          reg.adscripcionNuevaNombre || '',
          reg.numeroPlaza || '',
          reg.jornadaNueva || '',
          reg.turnoNueva || '',
          reg.zona || '',
          reg.categoria || '',
        ]
      } else {
        return [
          reg.nombre || '',
          reg.matricula || '',
          reg.fecha || '',
          reg.registro || '',
          reg.clave || '',
          reg.adscripcion || '',
          reg.zona || '',
          reg.categoria || '',
        ]
      }
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${documento.nombreArchivo || 'escalafon'}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando documento...</p>
        </div>
      </div>
    )
  }

  if (!documento) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Documento no encontrado</p>
            <Button onClick={() => router.push('/admin/escalafon')} className="mt-4">
              Volver a la lista
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{documento.nombreArchivo || 'Documento'}</h1>
            <p className="text-muted-foreground mt-2">
              {NOMBRES_TIPOS[documento.tipo]}
            </p>
          </div>
          <EstadoBadgeEscalafon estado={documento.estado} />
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <CardDescription>
            Mostrando {registrosPaginated.length} de {registrosFiltrados.length} registros
            {registrosFiltrados.length !== documento.registros.length &&
              ` (filtrados de ${documento.registros.length} totales)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Fila 1: Búsqueda y acciones */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={documento?.tipo === 'NUEVO_INGRESO'
                  ? "Buscar por nombre, matrícula, grupo, zona, categoría..."
                  : "Buscar por nombre, matrícula, clave..."}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filtroValidacion}
              onChange={(e) => setFiltroValidacion(e.target.value as any)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">Todos</option>
              <option value="validados">Validados</option>
              <option value="pendientes">Pendientes</option>
            </select>
            <Button onClick={exportarCSV} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>

          {/* Fila 2: Filtros avanzados */}
          <div className="space-y-4 mb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Filtros avanzados</h3>
              {(filtroZona !== 'all' || filtroCategoria !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltroZona('all')
                    setFiltroCategoria('all')
                    setBusquedaCategoria('')
                    setMostrarDropdownCategoria(false)
                  }}
                  className="text-xs"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {zonasUnicas.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Zona</label>
                  <select
                    value={filtroZona}
                    onChange={(e) => setFiltroZona(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="all">Todas las zonas</option>
                    {zonasUnicas.map((zona) => (
                      <option key={zona} value={zona}>
                        {zona}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {categoriasUnicas.length > 0 && (
                <div className="relative categoria-filter-container">
                  <label className="block text-sm font-medium mb-1">Categoría</label>
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Buscar categoría..."
                        value={filtroCategoria === 'all' ? busquedaCategoria : (filtroCategoria || busquedaCategoria)}
                        onChange={(e) => {
                          const valor = e.target.value
                          setBusquedaCategoria(valor)
                          setMostrarDropdownCategoria(true)
                          if (valor === '') {
                            setFiltroCategoria('all')
                          }
                        }}
                        onFocus={() => setMostrarDropdownCategoria(true)}
                        className="pl-10 pr-10"
                      />
                      {filtroCategoria !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setFiltroCategoria('all')
                            setBusquedaCategoria('')
                            setMostrarDropdownCategoria(false)
                          }}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {mostrarDropdownCategoria && categoriasFiltradas.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div
                          className="px-3 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            setFiltroCategoria('all')
                            setBusquedaCategoria('')
                            setMostrarDropdownCategoria(false)
                          }}
                        >
                          Todas las categorías
                        </div>
                        {categoriasFiltradas.slice(0, 100).map((categoria) => (
                          <div
                            key={categoria}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${filtroCategoria === categoria ? 'bg-blue-50 font-medium' : ''
                              }`}
                            onClick={() => {
                              setFiltroCategoria(categoria)
                              setBusquedaCategoria('')
                              setMostrarDropdownCategoria(false)
                            }}
                          >
                            {categoria}
                          </div>
                        ))}
                        {categoriasFiltradas.length > 100 && (
                          <div className="px-3 py-2 text-xs text-gray-400 text-center border-t">
                            Mostrando 100 de {categoriasFiltradas.length} resultados. Refina tu búsqueda.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {filtroCategoria !== 'all' && (
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {filtroCategoria}
                        <button
                          onClick={() => {
                            setFiltroCategoria('all')
                            setBusquedaCategoria('')
                          }}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="h-3 w-3 inline" />
                        </button>
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Controles de paginación superior */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm">Registros por página:</label>
              <select
                value={registrosPorPagina}
                onChange={(e) => {
                  setRegistrosPorPagina(Number(e.target.value))
                  setPaginaActual(1)
                }}
                className="px-2 py-1 border rounded-md"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {paginaActual} de {totalPaginas || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual >= totalPaginas}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabla de registros */}
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {documento.tipo === 'NUEVO_INGRESO' ? (
                    <>
                      <TableHead>No. Prog</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Fecha Registro</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Calificación</TableHead>
                      <TableHead>Días Laborados</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="w-12">Ver</TableHead>
                    </>
                  ) : documento.tipo === 'AMPLIACIONES_JORNADA' ? (
                    <>
                      <TableHead>No</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Plaza</TableHead>
                      <TableHead>Jornada (A/N)</TableHead>
                      <TableHead>Turno (A/N)</TableHead>
                      <TableHead>Adscripción Nva</TableHead>
                      <TableHead className="w-12">Ver</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Clave</TableHead>
                      <TableHead>Adscripción</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="w-12">Ver</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrosPaginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={documento.tipo === 'NUEVO_INGRESO' ? 10 : 8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay registros que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  registrosPaginated.map((registro) => (
                    <TableRow key={registro.id}>
                      {documento.tipo === 'NUEVO_INGRESO' ? (
                        <>
                          <TableCell>{registro.numeroProg || 'N/A'}</TableCell>
                          <TableCell className="font-medium">{registro.nombre || 'N/A'}</TableCell>
                          <TableCell>{registro.matricula || 'N/A'}</TableCell>
                          <TableCell>{registro.fecha || 'N/A'}</TableCell>
                          <TableCell>{registro.grupo || 'N/A'}</TableCell>
                          <TableCell>{registro.calificacion || 'N/A'}</TableCell>
                          <TableCell>{registro.diasLaborados || 'N/A'}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {registro.zona || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {registro.categoria || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirModalDetalle(registro)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </>
                      ) : documento.tipo === 'AMPLIACIONES_JORNADA' ? (
                        <>
                          <TableCell>{registro.numeroProg || 'N/A'}</TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{registro.nombre || 'N/A'}</TableCell>
                          <TableCell>{registro.matricula || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap">{registro.fecha || 'N/A'}</TableCell>
                          <TableCell>{registro.numeroPlaza || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-gray-500">{registro.jornadaActual}</span>
                            <span className="mx-1">→</span>
                            <span className="font-bold">{registro.jornadaNueva}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-gray-500 text-xs">{registro.turnoActual}</span>
                            <span className="mx-1">→</span>
                            <span className="font-bold">{registro.turnoNueva}</span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {registro.adscripcionNuevaNombre || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirModalDetalle(registro)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{registro.nombre || 'N/A'}</TableCell>
                          <TableCell>{registro.matricula || 'N/A'}</TableCell>
                          <TableCell>{registro.fecha || 'N/A'}</TableCell>
                          <TableCell>{registro.clave || 'N/A'}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {registro.adscripcion || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {registro.zona || 'N/A'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {registro.categoria || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirModalDetalle(registro)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Controles de paginación inferior */}
          {totalPaginas > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {indiceInicio + 1} - {Math.min(indiceFin, registrosFiltrados.length)} de {registrosFiltrados.length} registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual(1)}
                  disabled={paginaActual === 1}
                >
                  Primera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                  disabled={paginaActual === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm px-4">
                  Página {paginaActual} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual >= totalPaginas}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual(totalPaginas)}
                  disabled={paginaActual >= totalPaginas}
                >
                  Última
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalles del registro */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
          <DialogClose onClose={() => setModalAbierto(false)} />
          <DialogHeader>
            <DialogTitle>Detalles del Registro</DialogTitle>
            <DialogDescription>
              Información completa del registro seleccionado
            </DialogDescription>
          </DialogHeader>

          {registroSeleccionado && (
            <div className="space-y-4">
              {documento?.tipo === 'NUEVO_INGRESO' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">No. Prog</p>
                      <p className="font-medium">{registroSeleccionado.numeroProg || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nombre</p>
                      <p className="font-medium">{registroSeleccionado.nombre || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Matrícula</p>
                      <p className="font-medium">{registroSeleccionado.matricula || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha de Registro</p>
                      <p className="font-medium">{registroSeleccionado.fecha || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Grupo</p>
                      <p className="font-medium">{registroSeleccionado.grupo || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Calificación</p>
                      <p className="font-medium">{registroSeleccionado.calificacion || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo de Contratación</p>
                      <p className="font-medium">{registroSeleccionado.tipoContratacion || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Días Laborados</p>
                      <p className="font-medium">{registroSeleccionado.diasLaborados || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Estatus</p>
                      <Badge variant={registroSeleccionado.estatus === 'A' ? 'default' : 'secondary'}>
                        {registroSeleccionado.estatus || 'N/A'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Zona</p>
                      <p className="font-medium">{registroSeleccionado.zona || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Categoría</p>
                      <p className="font-medium">{registroSeleccionado.categoria || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Estado de Validación</p>
                      {registroSeleccionado.validado ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Validado
                        </Badge>
                      ) : registroSeleccionado.necesitaValidacion ? (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                          Pendiente
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin validar</Badge>
                      )}
                    </div>
                  </div>
                  {registroSeleccionado.observaciones && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Observaciones</p>
                      <p className="font-medium bg-muted p-3 rounded-md">
                        {registroSeleccionado.observaciones}
                      </p>
                    </div>
                  )}
                </>
              ) : documento?.tipo === 'AMPLIACIONES_JORNADA' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Información Personal */}
                    <div className="space-y-4 col-span-1 border-r pr-4">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Datos Personales</h4>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Matrícula</p>
                        <p className="font-bold text-lg">{registroSeleccionado.matricula || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Nombre Completo</p>
                        <p className="font-medium">{registroSeleccionado.nombre || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Sexo</p>
                        <Badge variant="outline">{registroSeleccionado.sexo || 'N/A'}</Badge>
                      </div>
                    </div>

                    {/* Situación Actual */}
                    <div className="space-y-4 col-span-1 border-r pr-4">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-blue-600">Situación Actual</h4>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Jornada</p>
                        <p className="font-medium">{registroSeleccionado.jornadaActual || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Turno</p>
                        <p className="font-medium">{registroSeleccionado.turnoActual || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Adscripción (Clave)</p>
                        <p className="font-medium">{registroSeleccionado.adscripcionActualClave || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Cambio Solicitado */}
                    <div className="space-y-4 col-span-1">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-green-600">Cambio Solicitado</h4>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Nueva Jornada</p>
                          <p className="font-bold text-lg text-green-700">{registroSeleccionado.jornadaNueva || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Nuevo Turno</p>
                          <p className="font-bold text-lg text-green-700">{registroSeleccionado.turnoNueva || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Nueva Adscripción</p>
                        <p className="font-medium">{registroSeleccionado.adscripcionNuevaNombre || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{registroSeleccionado.adscripcionNuevaClave}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Número de Plaza</p>
                        <Badge variant="secondary" className="font-mono">{registroSeleccionado.numeroPlaza || 'N/A'}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">No. Prog</p>
                      <p className="font-medium">{registroSeleccionado.numeroProg || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Fecha Registro</p>
                      <p className="font-medium">{registroSeleccionado.fecha || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Días Laborados</p>
                      <p className="font-medium">{registroSeleccionado.diasLaborados || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Estatus</p>
                      <Badge variant={registroSeleccionado.estatus === 'A' ? 'default' : 'secondary'}>
                        {registroSeleccionado.estatus || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nombre</p>
                      <p className="font-medium">{registroSeleccionado.nombre || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Matrícula</p>
                      <p className="font-medium">{registroSeleccionado.matricula || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha</p>
                      <p className="font-medium">{registroSeleccionado.fecha || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Clave</p>
                      <p className="font-medium">{registroSeleccionado.clave || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Adscripción</p>
                      <p className="font-medium">{registroSeleccionado.adscripcion || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Zona</p>
                      <p className="font-medium">{registroSeleccionado.zona || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Categoría</p>
                      <p className="font-medium">{registroSeleccionado.categoria || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Estado de Validación</p>
                      {registroSeleccionado.validado ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Validado
                        </Badge>
                      ) : registroSeleccionado.necesitaValidacion ? (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                          Pendiente
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin validar</Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {registroSeleccionado && !registroSeleccionado.validado && documento?.id && user?.uid && (
              <Button
                onClick={() => {
                  handleValidar(registroSeleccionado.id)
                  setModalAbierto(false)
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                Validar Registro
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
