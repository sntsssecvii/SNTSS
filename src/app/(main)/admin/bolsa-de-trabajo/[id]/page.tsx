'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Download, Search, ChevronLeft, ChevronRight,
  XCircle, Eye, FileText, Filter, CheckCircle2, Clock, AlertCircle, Edit2, Trash2, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  getBolsaDeTrabajoDocumentoHead,
  getRegistrosBolsaDeTrabajo,
  updateBolsaDeTrabajoDocumento,
  deleteBolsaDeTrabajoDocumento
} from '@/lib/firebase/bolsa-de-trabajo'
import type { BolsaDeTrabajoDocumento, BolsaDeTrabajoRegistro } from '@/types/bolsa-de-trabajo'
import { NOMBRES_TIPOS } from '@/types/bolsa-de-trabajo'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { EstadoBadgeBolsaDeTrabajo } from '@/components/bolsa-de-trabajo/EstadoBadgeBolsaDeTrabajo'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { calcularPosiciones, getTrabajadoresAntes } from '@/lib/bolsa-de-trabajo/calculos'
import { normalizePositionRecord } from '@/lib/bolsa-de-trabajo/position-engine'
import { positionStrategies } from '@/lib/bolsa-de-trabajo/position-strategies'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'

export default function DetalleBolsaDeTrabajoPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()

  const [documento, setDocumento] = useState<BolsaDeTrabajoDocumento | null>(null)
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [filtroValidacion, setFiltroValidacion] = useState<'all' | 'pendientes'>('all')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')
  const [filtroZona, setFiltroZona] = useState<string>('all')
  const [busquedaCategoria, setBusquedaCategoria] = useState('')
  const [busquedaZona, setBusquedaZona] = useState('')

  // Edición de nombre
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)

  // Eliminación de documento
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const registrosPorPagina = 50

  // Modal de detalles
  const [registroSeleccionado, setRegistroSeleccionado] = useState<BolsaDeTrabajoRegistro | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [mostrarAnteriores, setMostrarAnteriores] = useState(false)

  const cargarDocumento = useCallback(async (id: string) => {
    try {
      setLoading(true)
      
      // 1. Carga ultra-rápida del encabezado
      const head = await getBolsaDeTrabajoDocumentoHead(id)
      if (!head) {
        toast({ title: 'Error', description: 'No se pudo cargar el documento', variant: 'destructive' })
        setLoading(false)
        return
      }
      
      // Ya podemos mostrar la estructura de la página
      setDocumento(head)
      setNuevoNombre(head.nombreArchivo || '')
      setLoading(false) // <--- Quitamos el spinner global aquí
      
      // 2. Carga de registros en segundo plano (streaming)
      setStreaming(true)
      try {
        const regs = await getRegistrosBolsaDeTrabajo(id)
        setDocumento(prev => prev ? { ...prev, registros: regs } : null)
      } catch (err) {
        console.error('Error cargando registros:', err)
        toast({ title: 'Error parcial', description: 'No se pudieron cargar los detalles de los registros', variant: 'destructive' })
      } finally {
        setStreaming(false)
      }
      
    } catch (error: any) {
      console.error('Error general cargando documento:', error)
      toast({
        title: 'Error',
        description: 'Error en la conexión con el servidor',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (params.id) {
      cargarDocumento(params.id as string)
    }
  }, [params.id, cargarDocumento])

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda)
    }, 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  // Normalización para categorías
  const normalizarString = (str: string | undefined): string => {
    if (!str) return ''
    return str.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ')
  }

  // Obtener categorías únicas
  const categoriasUnicas = useMemo(() => {
    if (!documento) return []
    const catMap = new Map<string, string>()
    documento.registros.forEach(r => {
      if (r.categoria) {
        const norm = normalizarString(r.categoria)
        if (!catMap.has(norm) || r.categoria.length > catMap.get(norm)!.length) {
          catMap.set(norm, r.categoria.trim())
        }
      }
    })
    return Array.from(catMap.values()).sort()
  }, [documento])

  const categoriasFiltradas = useMemo(() => {
    if (!busquedaCategoria) return categoriasUnicas
    const lower = busquedaCategoria.toLowerCase()
    return categoriasUnicas.filter(c => c.toLowerCase().includes(lower))
  }, [categoriasUnicas, busquedaCategoria])

  // Obtener conteos de registros por categoría y zona (para evitar O(N*M) en el render)
  const stats = useMemo(() => {
    if (!documento) return { categorias: {}, zonas: {} }
    const catStats: Record<string, number> = {}
    const zonaStats: Record<string, number> = {}
    
    documento.registros.forEach(r => {
      if (r.categoria) {
        catStats[r.categoria] = (catStats[r.categoria] || 0) + 1
      }
      if (r.zona) {
        const z = r.zona.trim()
        zonaStats[z] = (zonaStats[z] || 0) + 1
      }
    })
    
    return { categorias: catStats, zonas: zonaStats }
  }, [documento])

  // Obtener zonas únicas
  const zonasUnicas = useMemo(() => {
    if (!documento) return []
    const zonaSet = new Set<string>()
    documento.registros.forEach(r => {
      if (r.zona) zonaSet.add(r.zona.trim())
    })
    return Array.from(zonaSet).sort()
  }, [documento])

  const zonasFiltradas = useMemo(() => {
    if (!busquedaZona) return zonasUnicas
    const lower = busquedaZona.toLowerCase()
    return zonasUnicas.filter(z => z.toLowerCase().includes(lower))
  }, [zonasUnicas, busquedaZona])

  // Nuevo useMemo para agrupar registros por su clave de comparación
  // Esto evita filtrar todo el array (O(N)) por cada fila que se muestra en pantalla (O(M)).
  const registrosPorGrupo = useMemo(() => {
    if (!documento) return new Map<string, BolsaDeTrabajoRegistro[]>()
    
    // Solo necesitamos agrupar para tipos que calculan posición
    const tiposConPosicion = [
      'NUEVO_INGRESO',
      'AMPLIACIONES_JORNADA',
      'CAMBIOS_TURNO_ADSCRIPCION',
      'CAMBIOS_RAMA',
      'CAMBIOS_AREA',
      'CAMBIOS_TIPO_PLAZA',
      'CAMBIOS_RESIDENCIA_DESTINO',
      'CAMBIOS_RESIDENCIA_ORIGEN',
    ]
    
    if (!tiposConPosicion.includes(documento.tipo)) return new Map<string, BolsaDeTrabajoRegistro[]>()
    
    const groups = new Map<string, BolsaDeTrabajoRegistro[]>()
    const tipo = documento.tipo
    const strategy = positionStrategies[tipo]
    
    documento.registros.forEach(reg => {
      const normalized = normalizePositionRecord(reg)
      const key = normalized && strategy
        ? strategy.buildGroupKey(normalized)
        : `${reg.categoria || ''}-${reg.subcategoria || ''}-${reg.zona || ''}`
      
      const existing = groups.get(key) || []
      existing.push(reg)
      groups.set(key, existing)
    })
    
    return groups
  }, [documento])

  // Filtrado de registros
  const registrosFiltrados = useMemo(() => {
    if (!documento) return []
    const lowerSearch = busquedaDebounced.toLowerCase()
    const normFiltroCat = filtroCategoria !== 'all' ? normalizarString(filtroCategoria) : ''
    
    return documento.registros.filter(reg => {
      // Filtro de búsqueda texto (usando el debounced para evitar lag)
      if (lowerSearch) {
        const coincide =
          reg.nombre?.toLowerCase().includes(lowerSearch) ||
          reg.matricula?.toLowerCase().includes(lowerSearch) ||
          reg.categoria?.toLowerCase().includes(lowerSearch) ||
          reg.zona?.toLowerCase().includes(lowerSearch)
        if (!coincide) return false
      }

      // Filtro de validación
      if (filtroValidacion === 'pendientes' && reg.validado) return false

      // Filtro de categoría
      if (normFiltroCat) {
        if (normalizarString(reg.categoria) !== normFiltroCat) return false
      }

      // Filtro de zona
      if (filtroZona !== 'all') {
        if (reg.zona !== filtroZona) return false
      }

      return true
    })
  }, [documento, busquedaDebounced, filtroValidacion, filtroCategoria, filtroZona])

  // Pre-calcular posiciones para los registros filtrados
  const totalPaginas = Math.ceil(registrosFiltrados.length / registrosPorPagina)
  
  // Obtener la página actual de registros
  const registrosEnPagina = useMemo(() => {
    return registrosFiltrados.slice((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina)
  }, [registrosFiltrados, paginaActual])

  // Pre-calcular posiciones SOLO para los registros de la página actual
  const registrosPaginated = useMemo(() => {
    if (!documento) return registrosEnPagina
    const tipo = documento.tipo

    const tiposConPosicion = [
      'NUEVO_INGRESO',
      'AMPLIACIONES_JORNADA',
      'CAMBIOS_TURNO_ADSCRIPCION',
      'CAMBIOS_RAMA',
      'CAMBIOS_AREA',
      'CAMBIOS_TIPO_PLAZA',
      'CAMBIOS_RESIDENCIA_DESTINO',
      'CAMBIOS_RESIDENCIA_ORIGEN',
    ]

    if (!tiposConPosicion.includes(tipo)) return registrosEnPagina

    const strategy = positionStrategies[tipo]

    return registrosEnPagina.map(reg => {
      const normalized = normalizePositionRecord(reg)
      const key = normalized && strategy
        ? strategy.buildGroupKey(normalized)
        : `${reg.categoria || ''}-${reg.subcategoria || ''}-${reg.zona || ''}`
      
      const grupoRegistros = registrosPorGrupo.get(key) || [reg]
      const pos = calcularPosiciones(grupoRegistros, reg.matricula || '', tipo)
      return { ...reg, _posCalculada: pos }
    })
  }, [documento, registrosEnPagina, registrosPorGrupo])

  useEffect(() => { setPaginaActual(1) }, [busquedaDebounced, filtroValidacion, filtroCategoria, filtroZona])

  const abrirModalDetalle = (reg: BolsaDeTrabajoRegistro) => {
    setRegistroSeleccionado(reg)
    setMostrarAnteriores(false)
    setModalAbierto(true)
  }

  const volverPasoAnterior = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push(rutaQuincena)
  }

  const exportarCSV = () => {
    if (!documento) return
    const headers = Object.keys(documento.registros[0] || {}).filter(k => k !== 'id')
    const rows = registrosFiltrados.map(r => headers.map(h => `"${(r as any)[h] || ''}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${documento.nombreArchivo || 'export'}.csv`
    link.click()
  }

  const handleGuardarNombre = async () => {
    if (!documento?.id || !nuevoNombre.trim()) return
    try {
      setGuardandoNombre(true)
      await updateBolsaDeTrabajoDocumento(documento.id, { nombreArchivo: nuevoNombre.trim() })
      setDocumento({ ...documento, nombreArchivo: nuevoNombre.trim() })
      setEditandoNombre(false)
      toast({ title: 'Éxito', description: 'Nombre del archivo actualizado' })
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar el nombre', variant: 'destructive' })
    } finally {
      setGuardandoNombre(false)
    }
  }

  const handleEliminarDocumento = async () => {
    if (!documento?.id) return
    try {
      setEliminando(true)
      await deleteBolsaDeTrabajoDocumento(documento.id)
      toast({ title: 'Eliminado', description: 'El documento ha sido eliminado con éxito' })
      volverPasoAnterior()
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el documento', variant: 'destructive' })
      setEliminando(false)
    }
  }

  const rutaQuincena = documento?.syncId
    ? `/admin/bolsa-de-trabajo/quincenas/${documento.syncId}`
    : '/admin/bolsa-de-trabajo'

  const rutaReemplazo = documento?.metadata?.anio && documento?.metadata?.mes && documento?.metadata?.quincena
    ? `/admin/bolsa-de-trabajo/cargar?anio=${documento.metadata.anio}&mes=${documento.metadata.mes}&quincena=${documento.metadata.quincena}&tipo=${documento.tipo}`
    : '/admin/bolsa-de-trabajo/cargar'

  const trabajadoresAntes = useMemo(() => {
    if (!documento || !registroSeleccionado?.matricula) return []
    return getTrabajadoresAntes(documento.registros, registroSeleccionado.matricula, documento.tipo)
  }, [documento, registroSeleccionado])

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-[#020617] space-y-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Sincronizando Registros...</p>
    </div>
  )

  if (!documento) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <XCircle className="w-16 h-16 text-slate-300 mb-4" />
      <h2 className="text-xl font-black">Documento no encontrado</h2>
      <Button onClick={() => router.push('/admin/bolsa-de-trabajo')} className="mt-4 rounded-xl">Volver</Button>
    </div>
  )

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 lg:left-64 top-14 bg-[#F8FAFC] dark:bg-[#020617] flex flex-col overflow-hidden z-20"
    >
      {/* HEADER STICKY */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shrink-0">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Button variant="ghost" size="icon" onClick={volverPasoAnterior} className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-full">
                    Documento del corte
                  </span>
                  {documento.metadata?.anio && (
                    <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                      {documento.metadata.quincena}° Qna {documento.metadata.mes}/{documento.metadata.anio}
                    </span>
                  )}
                  {streaming && (
                    <span className="text-[10px] font-black text-blue-500 uppercase bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Sincronizando...
                    </span>
                  )}
                </div>
              {editandoNombre ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="h-9 font-black text-lg py-0 px-3 min-w-[300px]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGuardarNombre()
                      if (e.key === 'Escape') setEditandoNombre(false)
                    }}
                  />
                  <Button size="sm" onClick={handleGuardarNombre} disabled={guardandoNombre} className="h-9 rounded-lg">
                    {guardandoNombre ? '...' : 'Guardar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditandoNombre(false)} className="h-9 w-9 p-0 rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group/title">
                  <h1 className="text-lg font-black truncate">{documento.nombreArchivo}</h1>
                  <button
                    onClick={() => setEditandoNombre(true)}
                    className="p-1.5 opacity-0 group-hover/title:opacity-100 transition-opacity hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {NOMBRES_TIPOS[documento.tipo]}
                </span>
                <span className="text-[10px] font-black text-primary uppercase">
                  {documento.totalRegistros} Registros Totales
                </span>
                {documento.syncId && (
                  <button
                    onClick={volverPasoAnterior}
                    className="text-[10px] font-black text-slate-500 uppercase underline-offset-4 hover:underline"
                  >
                    Volver al paso anterior
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => router.push(rutaReemplazo)}
              variant="outline"
              className="rounded-xl border-2 font-black h-10 px-4"
            >
              Reemplazar documento
            </Button>
            <Button onClick={exportarCSV} variant="outline" className="rounded-xl border-2 font-black h-10 px-4 hidden sm:flex">
              <Download className="mr-2 h-4 w-4" /> EXPORTAR
            </Button>
            <Button
              onClick={() => setConfirmandoEliminar(true)}
              variant="outline"
              className="rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-black h-10 w-10 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <EstadoBadgeBolsaDeTrabajo estado={documento.estado} />
          </div>
        </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden lg:flex-row">
        {/* SIDEBAR CATEGORIAS */}
        <motion.aside 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/20 lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-r flex flex-col h-full overflow-hidden"
        >
          <Tabs defaultValue="categorias" className="flex flex-col h-full w-full">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 shrink-0">
              <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl h-9">
                <TabsTrigger value="categorias" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                  Categorías
                  {filtroCategoria !== 'all' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1.5" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="zonas" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                  Zonas
                  {filtroZona !== 'all' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary ml-1.5" />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="categorias" className="flex-1 overflow-hidden flex flex-col m-0 p-4 lg:p-6 pb-4 pt-2 data-[state=inactive]:hidden focus-visible:outline-none focus-visible:ring-0">
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar categorías..."
                  value={busquedaCategoria}
                  onChange={(e) => setBusquedaCategoria(e.target.value)}
                  className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold shadow-sm"
                />
              </div>
              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] custom-scrollbar">
                  <div className="p-3 space-y-1">
                    <button
                      onClick={() => setFiltroCategoria('all')}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group",
                        filtroCategoria === 'all'
                          ? "bg-primary text-white font-black shadow-md shadow-primary/20"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold"
                      )}
                    >
                      <span className="text-[11px]">Todas las Categorías</span>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full",
                        filtroCategoria === 'all' ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      )}>
                        {documento.registros.length}
                      </span>
                    </button>

                    <div className="py-2.5 px-3 flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lista de Categorías</p>
                    </div>

                    {categoriasFiltradas.map((cat) => {
                      const active = filtroCategoria === cat
                      const count = stats.categorias[cat] || 0
                      return (
                        <button
                          key={cat}
                          onClick={() => setFiltroCategoria(cat)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group",
                            active
                              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold"
                          )}
                        >
                          <span className="truncate text-[10px] leading-tight pr-2">{cat}</span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-md flex-shrink-0",
                            active ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-100 dark:bg-slate-800"
                          )}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="zonas" className="flex-1 overflow-hidden flex flex-col m-0 p-4 lg:p-6 pb-4 pt-2 data-[state=inactive]:hidden focus-visible:outline-none focus-visible:ring-0">
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar zonas..."
                  value={busquedaZona}
                  onChange={(e) => setBusquedaZona(e.target.value)}
                  className="pl-9 h-9 rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-bold shadow-sm"
                />
              </div>
              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] custom-scrollbar">
                  <div className="p-3 space-y-1">
                    <button
                      onClick={() => setFiltroZona('all')}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group",
                        filtroZona === 'all'
                          ? "bg-primary text-white font-black shadow-md shadow-primary/20"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold"
                      )}
                    >
                      <span className="text-[11px]">Todas las Zonas</span>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full",
                        filtroZona === 'all' ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      )}>
                        {documento.registros.length}
                      </span>
                    </button>

                    <div className="py-2.5 px-3 flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lista de Zonas</p>
                    </div>

                    {zonasFiltradas.map((zona) => {
                      const active = filtroZona === zona
                      const count = stats.zonas[zona] || 0
                      return (
                        <button
                          key={zona}
                          onClick={() => setFiltroZona(zona)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between group",
                            active
                              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold"
                          )}
                        >
                          <span className="truncate text-[10px] leading-tight pr-2">{zona}</span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-md flex-shrink-0",
                            active ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-100 dark:bg-slate-800"
                          )}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.aside>

        {/* MAIN DATA GRID */}
        <motion.main 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#020617] h-full overflow-hidden"
        >
          {/* TOOLBAR PREMIUM */}
          <div className="px-4 lg:px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <div className="w-full xl:max-w-md relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Busca registros en esta sección..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 h-10 border-none bg-transparent shadow-none focus-visible:ring-0 rounded-xl font-bold text-xs"
                />
              </div>

              <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 xl:block" />

              <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 xl:px-0 xl:pb-0">
                <Button
                  variant={filtroValidacion === 'all' ? 'secondary' : 'ghost'}
                  size="sm" onClick={() => setFiltroValidacion('all')}
                  className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider"
                >
                  Todos ({registrosFiltrados.length})
                </Button>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                <Select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="h-10 rounded-xl border-none bg-white dark:bg-slate-800 text-[10px] font-black uppercase w-full sm:w-[160px] shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                >
                  <option value="all">Categoría: Todas</option>
                  {categoriasUnicas.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>

                <Select
                  value={filtroZona}
                  onChange={(e) => setFiltroZona(e.target.value)}
                  className="h-10 rounded-xl border-none bg-white dark:bg-slate-800 text-[10px] font-black uppercase w-full sm:w-[160px] shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                >
                  <option value="all">Zona: Todas</option>
                  {zonasUnicas.map(zona => (
                    <option key={zona} value={zona}>{zona}</option>
                  ))}
                </Select>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={paginaActual === 1} onClick={() => setPaginaActual(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-[10px] font-black text-slate-500 uppercase">{paginaActual} <span className="text-slate-300 dark:text-slate-600 mx-1">/</span> {totalPaginas || 1}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={paginaActual >= totalPaginas} onClick={() => setPaginaActual(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="flex-1 p-4 lg:p-6 bg-slate-50/50 dark:bg-[#020617]/50 relative min-h-0">
            <div className="absolute inset-4 lg:inset-6 overflow-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] custom-scrollbar">
              <Table className="border-separate border-spacing-0 min-w-[1000px]">
                <TableHeader className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <TableRow className="hover:bg-transparent">
                  {documento.tipo === 'NUEVO_INGRESO' ? (
                    <>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Prog</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Nombre del Trabajador</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Matrícula</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Categoría</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">Posiciones (I / B)</TableHead>
                      <TableHead className="w-16 border-b border-slate-200 dark:border-slate-800"></TableHead>
                    </>
                  ) : documento.tipo === 'CAMBIOS_TURNO_ADSCRIPCION' ? (
                    <>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">No. Progr.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Nombre / Categoría</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Matrícula</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Solicitud</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">Posición</TableHead>
                      <TableHead className="w-16 border-b border-slate-200 dark:border-slate-800"></TableHead>
                    </>
                  ) : documento.tipo === 'CAMBIOS_RESIDENCIA_DESTINO' || documento.tipo === 'CAMBIOS_RESIDENCIA_ORIGEN' ? (
                    <>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">No. Progr.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Nombre / Categoría</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Matrícula</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">{documento.tipo === 'CAMBIOS_RESIDENCIA_DESTINO' ? 'Delegación Destino' : 'Delegación Origen'}</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">Posición</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Días Lab.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Fecha Registro</TableHead>
                      <TableHead className="w-16 border-b border-slate-200 dark:border-slate-800"></TableHead>
                    </>
                  ) : documento.tipo === 'AMPLIACIONES_JORNADA' ? (
                    <>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">No. Progr.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Nombre / Categoría</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Matrícula</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Adscripción Solicitada</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">Posición</TableHead>
                      <TableHead className="w-16 border-b border-slate-200 dark:border-slate-800"></TableHead>
                    </>
                  ) : documento.tipo === 'CAMBIOS_RAMA' ? (
                    <>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">No. Progr.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Nombre / Categoría</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Matrícula</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Cód. Rama / Calificación</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">Posición</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Días Lab.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Fecha Registro</TableHead>
                      <TableHead className="w-16 border-b border-slate-200 dark:border-slate-800"></TableHead>
                    </>
                  ) : (
                    // CAMBIOS_AREA y CAMBIOS_TIPO_PLAZA
                    <>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">No. Progr.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Nombre / Categoría</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Matrícula</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Tipo → Adscripción Destino</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">Posición</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Días Lab.</TableHead>
                      <TableHead className="py-5 px-6 font-black text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">Fecha Registro</TableHead>
                      <TableHead className="w-16 border-b border-slate-200 dark:border-slate-800"></TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {streaming && registrosPaginated.length === 0 ? (
                  <TableSkeleton cols={documento.tipo === 'NUEVO_INGRESO' ? 5 : 7} />
                ) : registrosPaginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-300">
                          <Search className="w-8 h-8" />
                        </div>
                        <p className="text-xs font-black uppercase text-slate-400 tracking-tighter">Sin registros que coincidan</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  registrosPaginated.map((reg, i) => (
                    <TableRow key={reg.id} className={cn("group border-b border-slate-100 dark:border-slate-800", i % 2 === 0 ? "bg-white dark:bg-[#020617]" : "bg-slate-50/30 dark:bg-slate-950/20")}>
                      {documento.tipo === 'NUEVO_INGRESO' ? (
                        <>
                          <TableCell className="py-4 px-6 font-mono text-[10px] text-slate-500 font-black">{reg.numeroProg || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">{reg.nombre || 'SIN NOMBRE'}</p>
                          </TableCell>
                          <TableCell className="py-4 px-6 font-bold text-xs">{reg.matricula || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[200px]">{reg.categoria}</p>
                          </TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center justify-center gap-3">
                              {/* Posición Interinato (si es eventual) */}
                              {(reg as any)._posCalculada?.posicionInterinato ? (
                                <div className="flex flex-col items-center">
                                  <span className="text-sm font-black text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/50 min-w-[32px] text-center">
                                    {(reg as any)._posCalculada.posicionInterinato}
                                  </span>
                                  <span className="text-[8px] font-bold text-amber-500 mt-1 uppercase">Interinato</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center opacity-30">
                                  <span className="text-sm font-black text-slate-400 bg-slate-50 dark:bg-slate-900/10 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800/50 min-w-[32px] text-center">
                                    --
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Interinato</span>
                                </div>
                              )}

                              <div className="w-px h-8 bg-slate-100 dark:bg-slate-800" />

                              {/* Posición Base */}
                              <div className="flex flex-col items-center">
                                <span className="text-sm font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50 min-w-[32px] text-center">
                                  {(reg as any)._posCalculada?.posicionBase || reg.numeroProg || '---'}
                                </span>
                                <span className="text-[8px] font-bold text-emerald-500 mt-1 uppercase">Base</span>
                              </div>
                            </div>
                          </TableCell>
                        </>
                      ) : documento.tipo === 'CAMBIOS_TURNO_ADSCRIPCION' ? (
                        <>
                          <TableCell className="py-4 px-6 font-mono text-[10px] text-slate-500 font-black">{reg.numeroProg || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">{reg.nombre || 'SIN NOMBRE'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[250px]">{reg.categoria}</p>
                          </TableCell>
                          <TableCell className="py-4 px-6 font-bold text-xs">{reg.matricula || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase",
                                  reg.registro === 'CAT' ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-blue-100 text-blue-700 border border-blue-200"
                                )}>
                                  {reg.registro || '---'}
                                </span>
                                <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase">{reg.adscripcionNueva || '---'}</p>
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[180px]">{reg.adscripcionNuevaNombre}</p>
                              {reg.turnoNuevo && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9px] font-black border border-slate-200 mt-1 w-fit">
                                  Turno: {reg.turnoNuevo}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-violet-600 bg-violet-50 dark:bg-violet-900/10 px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-800/50 min-w-[32px] text-center shadow-sm">
                                {(reg as any)._posCalculada?.posicionBase || '---'}
                              </span>
                              <span className="text-[8px] font-bold text-violet-500 mt-1 uppercase tracking-widest">En Fila</span>
                            </div>
                          </TableCell>
                        </>
                      ) : documento.tipo === 'CAMBIOS_RESIDENCIA_DESTINO' || documento.tipo === 'CAMBIOS_RESIDENCIA_ORIGEN' ? (
                        <>
                          <TableCell className="py-4 px-6 font-mono text-[10px] text-slate-500 font-black">{reg.numeroProg || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">{reg.nombre || 'SIN NOMBRE'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[250px]">{reg.categoria}</p>
                          </TableCell>
                          <TableCell className="py-4 px-6 font-bold text-xs">{reg.matricula || '---'}</TableCell>
                          <TableCell className="py-4 px-6 text-xs font-bold text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                            {reg.delegacionDestino || reg.delegacionOrigen || '---'}
                          </TableCell>
                          <TableCell className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-cyan-600 bg-cyan-50 dark:bg-cyan-900/10 px-2.5 py-1 rounded-lg border border-cyan-200 dark:border-cyan-800/50 min-w-[32px] text-center shadow-sm">
                                {(reg as any)._posCalculada?.posicionBase || '---'}
                              </span>
                              <span className="text-[8px] font-bold text-cyan-500 mt-1 uppercase tracking-widest">En fila</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-xs font-black text-slate-500">{reg.diasLaborados || '---'}</TableCell>
                          <TableCell className="py-4 px-6 text-[10px] font-black uppercase text-slate-500">{reg.fecha}</TableCell>
                        </>
                      ) : documento.tipo === 'AMPLIACIONES_JORNADA' ? (
                        <>
                          <TableCell className="py-4 px-6 font-mono text-[10px] text-slate-500 font-black">{reg.numeroProg || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">{reg.nombre || 'SIN NOMBRE'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[250px]">{reg.categoria}</p>
                          </TableCell>
                          <TableCell className="py-4 px-6 font-bold text-xs">{reg.matricula || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex flex-col">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase">{reg.adscripcionNueva || '---'}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[180px]">{reg.adscripcionNuevaNombre}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/5 text-primary text-[9px] font-black border border-primary/10 w-fit">
                                  {reg.jornadaNueva ? `${reg.jornadaNueva} hrs` : '---'}
                                </span>
                                {reg.turnoNuevo && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9px] font-black border border-slate-200 w-fit">
                                    Turno: {reg.turnoNuevo}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-blue-600 bg-blue-50 dark:bg-blue-900/10 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800/50 min-w-[32px] text-center shadow-sm">
                                {(reg as any)._posCalculada?.posicionBase || '---'}
                              </span>
                              <span className="text-[8px] font-bold text-blue-500 mt-1 uppercase tracking-widest">En Listado</span>
                            </div>
                          </TableCell>
                        </>
                      ) : documento.tipo === 'CAMBIOS_RAMA' ? (
                        <>
                          <TableCell className="py-4 px-6 font-mono text-[10px] text-slate-500 font-black">{reg.numeroProg || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">{reg.nombre || 'SIN NOMBRE'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[250px]">{reg.categoria}</p>
                          </TableCell>
                          <TableCell className="py-4 px-6 font-bold text-xs">{reg.matricula || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs text-slate-800 dark:text-slate-200">{reg.ramaNueva || '---'}</span>
                              {reg.calificacion && <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{reg.calificacion} pts</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-900/10 px-2.5 py-1 rounded-lg border border-fuchsia-200 dark:border-fuchsia-800/50 min-w-[32px] text-center shadow-sm">
                                {(reg as any)._posCalculada?.posicionBase || '---'}
                              </span>
                              <span className="text-[8px] font-bold text-fuchsia-500 mt-1 uppercase tracking-widest">En fila</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-xs font-black text-slate-500">{reg.diasLaborados || '---'}</TableCell>
                          <TableCell className="py-4 px-6 text-[10px] font-black uppercase text-slate-500">{reg.fecha}</TableCell>
                        </>
                      ) : (
                        // CAMBIOS_AREA y CAMBIOS_TIPO_PLAZA
                        <>
                          <TableCell className="py-4 px-6 font-mono text-[10px] text-slate-500 font-black">{reg.numeroProg || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <p className="font-extrabold text-sm text-slate-900 dark:text-slate-200 group-hover:text-primary transition-colors leading-none">{reg.nombre || 'SIN NOMBRE'}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[250px]">{reg.categoria}</p>
                          </TableCell>
                          <TableCell className="py-4 px-6 font-bold text-xs">{reg.matricula || '---'}</TableCell>
                          <TableCell className="py-4 px-6">
                            <div className="flex items-center gap-1.5">
                              {reg.registro && <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-black text-slate-600 dark:text-slate-300">{reg.registro}</span>}
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate max-w-[160px]">{reg.adscripcionNueva || '---'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-black text-rose-600 bg-rose-50 dark:bg-rose-900/10 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800/50 min-w-[32px] text-center shadow-sm">
                                {(reg as any)._posCalculada?.posicionBase || '---'}
                              </span>
                              <span className="text-[8px] font-bold text-rose-500 mt-1 uppercase tracking-widest">En fila</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-xs font-black text-slate-500">{reg.diasLaborados || '---'}</TableCell>
                          <TableCell className="py-4 px-6 text-[10px] font-black uppercase text-slate-500">{reg.fecha}</TableCell>
                        </>
                      )}
                      <TableCell className="py-4 px-6 text-right">
                        <Button size="sm" variant="ghost" onClick={() => abrirModalDetalle(reg)} className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-all opacity-0 group-hover:opacity-100">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        </motion.main>
      </div>

      {/* MODAL DETALLES PREMIUM */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border-slate-200 dark:border-slate-800 shadow-2xl p-0">
          <div className="animate-in fade-in zoom-in duration-300">
            <div className="p-5 pb-6 space-y-4 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900/50 dark:to-[#020617]">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-inner">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black tracking-tight leading-none">Detalles del Personal</DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold mt-1 uppercase text-[9px] tracking-widest leading-none">Ficha técnica extraída</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {registroSeleccionado && (
                <div className="p-0 pt-0 space-y-4">
                  {documento?.tipo === 'NUEVO_INGRESO' ? (
                    // Nuevo Ingreso: vista genérica con todos los campos
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                      {Object.entries(registroSeleccionado)
                        .filter(([key, val]) => val && typeof val === 'string' && !['id', 'tipoDocumento', 'confianza', 'filaOriginal', 'necesitaValidacion'].includes(key))
                        .map(([key, value]) => (
                          <DetailItem key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} value={value as string} />
                        ))}
                    </div>
                  ) : (
                    // Todos los tipos de cambio: layout Trabajador + Situación Actual + Cambio Solicitado
                    <div className="space-y-4">
                      {/* INFORMACION PERSONAL */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Información del Trabajador</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <DetailItem label="No. Progresivo" value={registroSeleccionado.numeroProg} />
                          <DetailItem label="Nombre" value={registroSeleccionado.nombre} fullWidth />
                          <DetailItem label="Matrícula" value={registroSeleccionado.matricula} />
                          <DetailItem label="Sexo" value={registroSeleccionado.sexo} />
                          <DetailItem label="No. Plaza" value={registroSeleccionado.numeroPlaza} />
                          <DetailItem label="Categoría" value={registroSeleccionado.categoria} fullWidth />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CAMBIO SOLICITADO */}
                        <div className="border border-primary/10 p-4 rounded-2xl bg-white dark:bg-slate-950">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <p className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Cambio Solicitado</p>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {registroSeleccionado.registro && <DetailItem label="Tipo de Cambio" value={registroSeleccionado.registro} />}
                            {registroSeleccionado.adscripcionNueva && <DetailItem label="Adscripción Solicitada" value={registroSeleccionado.adscripcionNueva} fullWidth />}
                            {registroSeleccionado.delegacionDestino && <DetailItem label="Delegación Destino" value={registroSeleccionado.delegacionDestino} fullWidth />}
                            {registroSeleccionado.delegacionOrigen && <DetailItem label="Delegación Origen" value={registroSeleccionado.delegacionOrigen} fullWidth />}
                            {registroSeleccionado.ramaNueva && <DetailItem label="Rama Solicitada" value={registroSeleccionado.ramaNueva} />}
                            {registroSeleccionado.jornadaNueva && (
                              <DetailItem
                                label={documento?.tipo === 'CAMBIOS_AREA' ? 'Concepto' : 'Jornada Solicitada (Hrs)'}
                                value={String(registroSeleccionado.jornadaNueva)}
                              />
                            )}
                            {registroSeleccionado.turnoNuevo && <DetailItem label="Turno Solicitado" value={registroSeleccionado.turnoNuevo} />}
                            {registroSeleccionado.calificacion && <DetailItem label="Puntos de Evaluación" value={String(registroSeleccionado.calificacion)} />}
                            <DetailItem label="Fecha de Registro" value={registroSeleccionado.fecha} />
                            <DetailItem label="Estatus" value={registroSeleccionado.estatus} />
                          </div>
                        </div>

                        {/* SITUACION ACTUAL */}
                        <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Situación Actual</p>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <DetailItem label="Adscripción Actual" value={registroSeleccionado.adscripcionAnterior} fullWidth />
                            <DetailItem label="Turno Actual" value={registroSeleccionado.turnoAnterior} />
                            <DetailItem label="Jornada Actual (Hrs)" value={registroSeleccionado.jornadaActual} />
                            <DetailItem label="Días Laborados" value={registroSeleccionado.diasLaborados} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950">
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Validación de posición</p>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          Personas antes que este trabajador
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {trabajadoresAntes.length === 0
                            ? 'No hay personas antes en el grupo comparable actual.'
                            : `Hay ${trabajadoresAntes.length} persona(s) arriba dentro del mismo grupo comparable.`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setMostrarAnteriores((value) => !value)}
                        className="rounded-xl font-black"
                      >
                        {mostrarAnteriores ? 'Ocultar lista' : 'Ver posiciones'}
                      </Button>
                    </div>

                    {mostrarAnteriores && (
                      <div className="border-t border-slate-200 dark:border-slate-800">
                        {trabajadoresAntes.length === 0 ? (
                          <div className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                            Este trabajador ya aparece en la primera posición del grupo comparable.
                          </div>
                        ) : (
                          <div className="max-h-[320px] overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Posición</TableHead>
                                  <TableHead>Nombre</TableHead>
                                  <TableHead>Matrícula</TableHead>
                                  <TableHead>Categoría</TableHead>
                                  <TableHead>Turno</TableHead>
                                  <TableHead>Referencia</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {trabajadoresAntes.map(({ posicionBase, registro }) => (
                                  <TableRow key={`${registro.id}-${posicionBase}`}>
                                    <TableCell className="font-black text-primary">{posicionBase}</TableCell>
                                    <TableCell className="font-semibold">{registro.nombre || '---'}</TableCell>
                                    <TableCell>{registro.matricula || '---'}</TableCell>
                                    <TableCell className="max-w-[220px] truncate">{registro.subcategoria || registro.categoria || '---'}</TableCell>
                                    <TableCell>{registro.turnoNuevo || '---'}</TableCell>
                                    <TableCell className="max-w-[240px] truncate text-slate-500">
                                      {registro.adscripcionNueva || registro.turnoNuevo || registro.zona || '---'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 flex items-center justify-end">
                <Button onClick={() => setModalAbierto(false)} className="rounded-xl font-black px-10 h-10 text-xs shadow-lg shadow-primary/20">
                  LISTO
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMACION ELIMINAR */}
      <Dialog open={confirmandoEliminar} onOpenChange={setConfirmandoEliminar}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">¿Eliminar documento?</DialogTitle>
            <DialogDescription className="font-medium text-slate-500 pt-2">
              Esta acción eliminará definitivamente el archivo <b>{documento.nombreArchivo}</b> y sus {documento.totalRegistros} registros asociados. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmandoEliminar(false)} disabled={eliminando} className="rounded-xl font-bold">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleEliminarDocumento} disabled={eliminando} className="rounded-xl font-black px-8">
              {eliminando ? 'Eliminando...' : 'Sí, Eliminar Todo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function DetailItem({ label, value, fullWidth = false }: { label: string, value: string | undefined, fullWidth?: boolean }) {
  if (!value) return null
  return (
    <div className={cn("space-y-0.5 group border-b border-slate-100 dark:border-slate-800 pb-1", fullWidth && "md:col-span-3")}>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">
        {label}
      </p>
      <p className="text-sm font-extrabold text-slate-900 dark:text-white break-words leading-tight">
        {value}
      </p>
    </div>
  )
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {[...Array(10)].map((_, i) => (
        <TableRow key={i} className="animate-pulse border-b border-slate-100 dark:border-slate-800">
          {[...Array(cols)].map((__, j) => (
            <TableCell key={j} className="py-4 px-6">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}
