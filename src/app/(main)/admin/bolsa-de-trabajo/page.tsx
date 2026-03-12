'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter, LayoutGrid, List, FileText, Activity, ArrowLeft, ChevronRight, Edit2, Trash2, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getBolsaDeTrabajoDocumentos, updateBolsaDeTrabajoDocumento, deleteBolsaDeTrabajoDocumento } from '@/lib/firebase/bolsa-de-trabajo'
import type { BolsaDeTrabajoDocumento, TipoBolsaDeTrabajo, FiltrosBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import { NOMBRES_TIPOS } from '@/types/bolsa-de-trabajo'
import { useToast } from '@/components/ui/use-toast'
import { PeriodSelector } from '@/components/bolsa-de-trabajo/PeriodSelector'
import { DocumentTypeGrid } from '@/components/bolsa-de-trabajo/DocumentTypeGrid'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'

export default function BolsaDeTrabajoPage() {
  const [documentos, setDocumentos] = useState<BolsaDeTrabajoDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<{ anio: number; mes: number; quincena: 1 | 2 }>({
    anio: new Date().getFullYear(),
    mes: new Date().getMonth() + 1,
    quincena: new Date().getDate() <= 15 ? 1 : 2
  })
  const [busqueda, setBusqueda] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedTipo, setSelectedTipo] = useState<TipoBolsaDeTrabajo | null>(null)
  const [filtroZona, setFiltroZona] = useState<string>('all')

  // Acciones sobre archivos en la lista
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const router = useRouter()
  const { toast } = useToast()

  const cargarDocumentos = useCallback(async () => {
    try {
      setLoading(true)
      const filtros: FiltrosBolsaDeTrabajo = {
        anio: periodo.anio,
        mes: periodo.mes,
        quincena: periodo.quincena
      }
      const resultado = await getBolsaDeTrabajoDocumentos(filtros, 100)
      setDocumentos(resultado.documentos)
    } catch (error: any) {
      console.error('Error cargando documentos:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los documentos del periodo seleccionado',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [periodo, toast])

  useEffect(() => {
    cargarDocumentos()
  }, [cargarDocumentos])

  const filteredDocs = useMemo(() => {
    let result = documentos
    if (busqueda) {
      const lower = busqueda.toLowerCase()
      result = result.filter(doc =>
        doc.nombreArchivo?.toLowerCase().includes(lower) ||
        doc.metadata?.zona?.toLowerCase().includes(lower) ||
        doc.metadata?.categoria?.toLowerCase().includes(lower)
      )
    }
    if (filtroZona !== 'all') {
      result = result.filter(doc => doc.metadata?.zona === filtroZona)
    }
    return result
  }, [documentos, busqueda, filtroZona])

  const zonasDisponibles = useMemo(() => {
    const zones = new Set<string>()
    documentos.forEach(doc => {
      if (doc.metadata?.zona) zones.add(doc.metadata.zona)
    })
    return Array.from(zones).sort()
  }, [documentos])

  const handleRename = async (id: string) => {
    if (!newName.trim()) return
    try {
      setSavingName(true)
      await updateBolsaDeTrabajoDocumento(id, { nombreArchivo: newName.trim() })
      setDocumentos(prev => prev.map(d => d.id === id ? { ...d, nombreArchivo: newName.trim() } : d))
      setEditingId(null)
      toast({ title: 'Éxito', description: 'Archivo renombrado' })
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo renombrar el archivo', variant: 'destructive' })
    } finally {
      setSavingName(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDeleteId) return
    try {
      setDeleting(true)
      await deleteBolsaDeTrabajoDocumento(confirmDeleteId)
      setDocumentos(prev => prev.filter(d => d.id !== confirmDeleteId))
      setConfirmDeleteId(null)
      toast({ title: 'Eliminado', description: 'El archivo ha sido eliminado' })
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el archivo', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary w-fit"
            >
              <Activity className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-widest">Dashboard de Operaciones</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white"
            >
              Bolsa de <span className="text-primary italic">Trabajo</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-500 dark:text-slate-400 text-lg font-medium"
            >
              Gestión visual de procesos quincenales y categorías.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3"
          >
            <Button
              size="lg"
              onClick={() => router.push('/admin/bolsa-de-trabajo/cargar')}
              className="rounded-2xl h-14 px-8 font-black text-lg shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105"
            >
              <Plus className="mr-3 h-6 w-6 stroke-[3]" />
              SUBIR ARCHIVO
            </Button>
          </motion.div>
        </header>

        {/* Filters Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col lg:flex-row items-center gap-4 bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xl"
        >
          <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Buscar por zona, categoría o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-950/50 border-none rounded-2xl focus-visible:ring-primary/20 text-base font-medium"
            />
          </div>

          <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-800 hidden lg:block" />

          <PeriodSelector
            anio={periodo.anio}
            mes={periodo.mes}
            quincena={periodo.quincena}
            onChange={setPeriodo}
          />

          <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-800 hidden lg:block" />

          <div className="flex bg-slate-100 dark:bg-slate-950/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className={cn("h-9 w-9 rounded-xl transition-all", viewMode === 'grid' && "shadow-sm border border-slate-200 bg-white dark:bg-slate-800")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className={cn("h-9 w-9 rounded-xl transition-all", viewMode === 'list' && "shadow-sm border border-slate-200 bg-white dark:bg-slate-800")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="text-slate-500 font-black animate-pulse uppercase tracking-widest text-xs">Cargando Documentación...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-[400px] text-center space-y-6"
            >
              <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                <FileText className="h-10 w-10 text-slate-300" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">No hay documentos en este periodo</h3>
                <p className="text-slate-500 max-w-sm">No hemos encontrado registros para la {periodo.quincena}ª quincena de {periodo.mes}/{periodo.anio}.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/admin/bolsa-de-trabajo/cargar')}
                className="rounded-xl border-2 font-bold px-6"
              >
                Cargar Primer Archivo
              </Button>
            </motion.div>
          ) : selectedTipo ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedTipo(null)
                      setFiltroZona('all')
                    }}
                    className="rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{NOMBRES_TIPOS[selectedTipo]}</h2>
                    <p className="text-sm text-slate-500 font-medium">Archivos disponibles para este periodo</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={filtroZona}
                    onChange={(e) => setFiltroZona(e.target.value)}
                    className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-black uppercase w-[200px]"
                  >
                    <option value="all">Filtrar por Zona: Todas</option>
                    {zonasDisponibles.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredDocs.filter(d => d.tipo === selectedTipo).length > 0 ? (
                  filteredDocs
                    .filter(d => d.tipo === selectedTipo)
                    .map((doc, idx) => {
                      const isEditing = editingId === doc.id
                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group flex items-center justify-between p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl hover:border-primary transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5 backdrop-blur-sm relative"
                        >
                          <div
                            className="absolute inset-0 z-0 cursor-pointer rounded-3xl"
                            onClick={() => !isEditing && router.push(`/admin/bolsa-de-trabajo/${doc.id}`)}
                          />

                          <div className="flex items-center gap-6 relative z-10 w-full">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                              <FileText className="h-8 w-8" />
                            </div>

                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <div className="flex items-center gap-2 max-w-md" onClick={e => e.stopPropagation()}>
                                  <Input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="h-9 font-black text-lg"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRename(doc.id!)
                                      if (e.key === 'Escape') setEditingId(null)
                                    }}
                                  />
                                  <Button size="icon" onClick={() => handleRename(doc.id!)} disabled={savingName} className="h-9 w-9">
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-9 w-9">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">
                                      {doc.nombreArchivo || 'Archivo sin nombre'}
                                    </h4>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setNewName(doc.nombreArchivo || '')
                                          setEditingId(doc.id!)
                                        }}
                                      >
                                        <Edit2 className="h-3.5 w-3.5 text-slate-400 hover:text-primary" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setConfirmDeleteId(doc.id!)
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 mt-1">
                                    <span className="text-sm text-slate-400 font-medium">
                                      {doc.totalRegistros || 0} registros extraídos
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-8 relative z-10">
                            <div className="flex flex-col items-end gap-1">
                              <div className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                doc.estado === 'COMPLETADO' ? "bg-emerald-100 text-emerald-700" :
                                  doc.estado === 'ERROR' ? "bg-red-100 text-red-700" :
                                    "bg-blue-100 text-blue-700 animate-pulse"
                              )}>
                                {doc.estado}
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold">
                                CARGADO: {doc.fechaCarga instanceof Date ? doc.fechaCarga.toLocaleDateString() : (doc.fechaCarga as any).toDate?.().toLocaleDateString() || 'N/A'}
                              </p>
                            </div>
                            <div
                              onClick={() => router.push(`/admin/bolsa-de-trabajo/${doc.id}`)}
                              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-300 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:translate-x-1 cursor-pointer"
                            >
                              <ChevronRight className="h-6 w-6" />
                            </div>
                          </div>
                        </motion.div>
                      )
                    })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <FileText className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">No se encontraron archivos</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mt-1">No hay archivos que coincidan con los filtros para este tipo de documento.</p>
                    <Button
                      variant="link"
                      onClick={() => setSelectedTipo(null)}
                      className="mt-4 text-primary font-bold"
                    >
                      Volver a todas las categorías
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <DocumentTypeGrid
              documentos={filteredDocs}
              onTipoClick={(tipo) => {
                const docs = filteredDocs.filter(d => d.tipo === tipo)
                if (docs.length === 1) {
                  router.push(`/admin/bolsa-de-trabajo/${docs[0].id}`)
                } else {
                  setSelectedTipo(tipo)
                }
              }}
            />
          )}
        </div>
      </div>

      {/* MODAL ELIMINAR */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">¿Eliminar documento?</DialogTitle>
            <DialogDescription className="font-medium text-slate-500 pt-2">
              Esta acción eliminará definitivamente el archivo y todos sus registros asociados. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} disabled={deleting} className="rounded-xl font-bold">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-xl font-black px-8">
              {deleting ? 'Eliminando...' : 'Sí, Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
