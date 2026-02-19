'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Calendar, Filter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getBolsaDeTrabajoDocumentos, deleteBolsaDeTrabajoDocumento } from '@/lib/firebase/bolsa-de-trabajo'
import type { BolsaDeTrabajoDocumento, TipoBolsaDeTrabajo, EstadoProcesamiento, FiltrosBolsaDeTrabajo } from '@/types/bolsa-de-trabajo'
import { NOMBRES_TIPOS } from '@/types/bolsa-de-trabajo'
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { EstadoBadgeBolsaDeTrabajo } from '@/components/bolsa-de-trabajo/EstadoBadgeBolsaDeTrabajo'

export default function BolsaDeTrabajoPage() {
  const [documentos, setDocumentos] = useState<BolsaDeTrabajoDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState<FiltrosBolsaDeTrabajo>({})
  const [busqueda, setBusqueda] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    cargarDocumentos()
  }, [filtros])

  const cargarDocumentos = async () => {
    try {
      setLoading(true)
      const resultado = await getBolsaDeTrabajoDocumentos(filtros, 50)
      setDocumentos(resultado.documentos)
    } catch (error: any) {
      console.error('Error cargando documentos:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los documentos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este documento?')) {
      return
    }

    try {
      await deleteBolsaDeTrabajoDocumento(id)
      toast({
        title: 'Éxito',
        description: 'Documento eliminado correctamente',
      })
      cargarDocumentos()
    } catch (error: any) {
      console.error('Error eliminando documento:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el documento',
        variant: 'destructive',
      })
    }
  }

  const documentosFiltrados = documentos.filter((doc) => {
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase()
      return (
        doc.nombreArchivo?.toLowerCase().includes(busquedaLower) ||
        NOMBRES_TIPOS[doc.tipo].toLowerCase().includes(busquedaLower) ||
        doc.metadata?.zona?.toLowerCase().includes(busquedaLower) ||
        doc.metadata?.categoria?.toLowerCase().includes(busquedaLower)
      )
    }
    return true
  })

  const estados: EstadoProcesamiento[] = ['PROCESANDO', 'COMPLETADO', 'ERROR', 'VALIDANDO']
  const tipos: TipoBolsaDeTrabajo[] = [
    'AMPLIACIONES_JORNADA',
    'CAMBIOS_AREA',
    'CAMBIOS_RAMA',
    'CAMBIOS_RESIDENCIA_DESTINO',
    'CAMBIOS_RESIDENCIA_ORIGEN',
    'CAMBIOS_TIPO_PLAZA',
    'CAMBIOS_TURNO_ADSCRIPCION',
    'NUEVO_INGRESO',
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Bolsa de Trabajo</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona los documentos de bolsa de trabajo procesados
          </p>
        </div>
        <Button onClick={() => router.push('/admin/bolsa-de-trabajo/cargar')}>
          <Plus className="mr-2 h-4 w-4" />
          Cargar Documento
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, tipo, zona..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tipo</label>
              <Select
                value={filtros.tipo?.[0] || ''}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    tipo: e.target.value ? [e.target.value as TipoBolsaDeTrabajo] : undefined,
                  })
                }
              >
                <option value="">Todos los tipos</option>
                {tipos.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {NOMBRES_TIPOS[tipo]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Estado</label>
              <Select
                value={filtros.estado?.[0] || ''}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    estado: e.target.value ? [e.target.value as EstadoProcesamiento] : undefined,
                  })
                }
              >
                <option value="">Todos los estados</option>
                {estados.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de documentos */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cargando documentos...</p>
        </div>
      ) : documentosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-muted-foreground mb-4">
              No hay documentos de bolsa de trabajo cargados
            </p>
            <Button onClick={() => router.push('/admin/bolsa-de-trabajo/cargar')}>
              <Plus className="mr-2 h-4 w-4" />
              Cargar Primer Documento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documentosFiltrados.map((documento) => (
            <Card key={documento.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {documento.nombreArchivo || 'Sin nombre'}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {NOMBRES_TIPOS[documento.tipo]}
                    </CardDescription>
                  </div>
                  <EstadoBadgeBolsaDeTrabajo estado={documento.estado} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Registros</p>
                    <p className="text-lg font-semibold">
                      {documento.totalRegistros || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Validados</p>
                    <p className="text-lg font-semibold">
                      {documento.registrosValidados || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Zona</p>
                    <p className="text-lg font-semibold">
                      {documento.metadata?.zona || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de Carga</p>
                    <p className="text-sm font-medium">
                      {format(
                        documento.fechaCarga instanceof Date
                          ? documento.fechaCarga
                          : (documento.fechaCarga as any).toDate(),
                        'dd/MM/yyyy',
                        { locale: es }
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/admin/bolsa-de-trabajo/${documento.id}`)}
                  >
                    Ver Detalles
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleEliminar(documento.id!)}
                  >
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
