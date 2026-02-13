'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { useToast } from './ui/use-toast'
import { DuplicadoAlert } from './DuplicadoAlert'
import {
  createPropuesta,
  updatePropuesta,
  checkDuplicados,
  getPropuestaById,
} from '@/lib/firebase/propuestas'
import { useAuth } from '@/contexts/AuthContext'
import type {
  TrabajadorActivo,
  Aspirante,
  Propuesta,
  DuplicadoDetectado,
} from '@/types/propuestas'
import {
  CATEGORIAS_ARRAY,
  PARENTESCOS,
  validarCURP,
  validarRFC,
  validarTelefono,
} from '@/types/propuestas'
import { Loader2, Save, AlertCircle, User, Briefcase, FileUser } from 'lucide-react'

interface PropuestaFormProps {
  propuestaId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function PropuestaForm({ propuestaId, onSuccess, onCancel }: PropuestaFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const isModal = !!onCancel || !!onSuccess
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(!!propuestaId)
  const [showDuplicados, setShowDuplicados] = useState(false)
  const [duplicados, setDuplicados] = useState<DuplicadoDetectado[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Datos del Trabajador Activo
  const [trabajador, setTrabajador] = useState<TrabajadorActivo>({
    nombre: '',
    matricula: '',
    adscripcion: '',
    localidad: '',
    antiguedad: '',
    telefono: '',
  })

  // Datos del Aspirante
  const [aspirante, setAspirante] = useState<Aspirante>({
    nombre: '',
    domicilio: '',
    curp: '',
    rfc: '',
    parentesco: 'Hijo(a)',
    localidadDeseada: '',
    telefono: '',
    categoria: CATEGORIAS_ARRAY[0],
  })

  // Cargar datos si estamos editando
  useEffect(() => {
    if (propuestaId) {
      const cargarPropuesta = async () => {
        try {
          const propuesta = await getPropuestaById(propuestaId)
          if (propuesta) {
            setTrabajador(propuesta.trabajadorActivo)
            setAspirante(propuesta.aspirante)
          }
        } catch (error) {
          console.error('Error cargando propuesta:', error)
          toast({
            title: 'Error',
            description: 'No se pudo cargar la propuesta',
            variant: 'destructive',
          })
        } finally {
          setLoadingData(false)
        }
      }
      cargarPropuesta()
    }
  }, [propuestaId, toast])

  // Validar formulario
  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {}

    // Validar Trabajador Activo
    if (!trabajador.nombre.trim()) {
      nuevosErrores['trabajador.nombre'] = 'El nombre del trabajador es requerido'
    }
    if (!trabajador.matricula.trim()) {
      nuevosErrores['trabajador.matricula'] = 'La matrícula es requerida'
    }
    if (!trabajador.adscripcion.trim()) {
      nuevosErrores['trabajador.adscripcion'] = 'La adscripción es requerida'
    }
    if (!trabajador.localidad.trim()) {
      nuevosErrores['trabajador.localidad'] = 'La localidad es requerida'
    }
    if (!trabajador.antiguedad.trim()) {
      nuevosErrores['trabajador.antiguedad'] = 'La antigüedad es requerida'
    }
    if (!validarTelefono(trabajador.telefono)) {
      nuevosErrores['trabajador.telefono'] = 'El teléfono debe tener 10 dígitos'
    }

    // Validar Aspirante
    if (!aspirante.nombre.trim()) {
      nuevosErrores['aspirante.nombre'] = 'El nombre del aspirante es requerido'
    }
    if (!aspirante.domicilio.trim()) {
      nuevosErrores['aspirante.domicilio'] = 'El domicilio es requerido'
    }
    if (aspirante.curp && !validarCURP(aspirante.curp)) {
      nuevosErrores['aspirante.curp'] = 'El formato del CURP no es válido'
    }
    if (aspirante.rfc && !validarRFC(aspirante.rfc)) {
      nuevosErrores['aspirante.rfc'] = 'El formato del RFC no es válido'
    }
    if (!aspirante.localidadDeseada.trim()) {
      nuevosErrores['aspirante.localidadDeseada'] = 'La localidad deseada es requerida'
    }
    if (!validarTelefono(aspirante.telefono)) {
      nuevosErrores['aspirante.telefono'] = 'El teléfono debe tener 10 dígitos'
    }
    if (!aspirante.categoria) {
      nuevosErrores['aspirante.categoria'] = 'La categoría es requerida'
    }

    // Al menos CURP o RFC debe estar presente
    if (!aspirante.curp && !aspirante.rfc) {
      nuevosErrores['aspirante.curp'] = 'Debe proporcionar CURP o RFC'
      nuevosErrores['aspirante.rfc'] = 'Debe proporcionar CURP o RFC'
    }

    setErrors(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validarFormulario()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, corrige los errores en el formulario',
        variant: 'destructive',
      })
      return
    }

    if (!user) {
      toast({
        title: 'Error',
        description: 'Debes estar autenticado para crear propuestas',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      // Verificar duplicados antes de guardar
      const duplicadosEncontrados = await checkDuplicados(
        trabajador,
        aspirante,
        propuestaId
      )

      if (duplicadosEncontrados.length > 0) {
        setDuplicados(duplicadosEncontrados)
        setShowDuplicados(true)
        setLoading(false)
        return
      }

      // Si no hay duplicados, guardar directamente
      await guardarPropuesta()
    } catch (error: any) {
      console.error('Error en handleSubmit:', error)
      toast({
        title: 'Error',
        description: error.message || 'Ocurrió un error al procesar la propuesta',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  // Guardar propuesta (crear o actualizar)
  const guardarPropuesta = async () => {
    try {
      if (propuestaId) {
        // Actualizar propuesta existente
        await updatePropuesta(propuestaId, trabajador, aspirante)
        toast({
          title: 'Éxito',
          description: 'Propuesta actualizada correctamente',
        })
      } else {
        // Crear nueva propuesta
        await createPropuesta(trabajador, aspirante, user!.uid, user!.email || undefined)
        toast({
          title: 'Éxito',
          description: 'Propuesta creada correctamente',
        })
      }

      if (onSuccess) {
        onSuccess()
      } else if (!isModal) {
        router.push('/admin/propuestas')
      }
    } catch (error: any) {
      console.error('Error guardando propuesta:', error)
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar la propuesta',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Confirmar guardado a pesar de duplicados
  const handleConfirmarConDuplicados = async () => {
    setShowDuplicados(false)
    await guardarPropuesta()
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <DuplicadoAlert
        open={showDuplicados}
        duplicados={duplicados}
        onConfirm={handleConfirmarConDuplicados}
        onCancel={() => {
          setShowDuplicados(false)
          setLoading(false)
        }}
      />

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 md:space-y-8">
        {/* Sección 1: Datos del Trabajador Activo */}
        <div className="space-y-4 sm:space-y-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg sm:rounded-xl p-4 sm:p-5 md:p-6 border border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b border-blue-200 dark:border-blue-800">
            <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex-shrink-0">
              <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Datos del Trabajador Activo
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                Información del trabajador del IMSS que solicita la propuesta
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="trabajador.nombre" className="text-xs sm:text-sm font-semibold">
                Nombre del Trabajador <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trabajador.nombre"
                value={trabajador.nombre}
                onChange={(e) =>
                  setTrabajador({ ...trabajador, nombre: e.target.value })
                }
                placeholder="Nombre completo"
                className={`h-9 sm:h-10 md:h-11 text-sm ${errors['trabajador.nombre'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-blue-500'}`}
              />
              {errors['trabajador.nombre'] && (
                <p className="text-xs sm:text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {errors['trabajador.nombre']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trabajador.matricula" className="text-sm font-semibold">
                Matrícula <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trabajador.matricula"
                value={trabajador.matricula}
                onChange={(e) =>
                  setTrabajador({ ...trabajador, matricula: e.target.value })
                }
                placeholder="Número de matrícula"
                className={`h-11 ${errors['trabajador.matricula'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-blue-500'}`}
              />
              {errors['trabajador.matricula'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['trabajador.matricula']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trabajador.adscripcion" className="text-sm font-semibold">
                Adscripción <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trabajador.adscripcion"
                value={trabajador.adscripcion}
                onChange={(e) =>
                  setTrabajador({ ...trabajador, adscripcion: e.target.value })
                }
                placeholder="Unidad médica o área"
                className={`h-11 ${errors['trabajador.adscripcion'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-blue-500'}`}
              />
              {errors['trabajador.adscripcion'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['trabajador.adscripcion']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trabajador.localidad" className="text-sm font-semibold">
                Localidad <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trabajador.localidad"
                value={trabajador.localidad}
                onChange={(e) =>
                  setTrabajador({ ...trabajador, localidad: e.target.value })
                }
                placeholder="Ciudad o localidad"
                className={`h-11 ${errors['trabajador.localidad'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-blue-500'}`}
              />
              {errors['trabajador.localidad'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['trabajador.localidad']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trabajador.antiguedad" className="text-sm font-semibold">
                Antigüedad <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trabajador.antiguedad"
                value={trabajador.antiguedad}
                onChange={(e) =>
                  setTrabajador({ ...trabajador, antiguedad: e.target.value })
                }
                placeholder="Ej: 5 años"
                className={`h-11 ${errors['trabajador.antiguedad'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-blue-500'}`}
              />
              {errors['trabajador.antiguedad'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['trabajador.antiguedad']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trabajador.telefono" className="text-sm font-semibold">
                Teléfono <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trabajador.telefono"
                type="tel"
                value={trabajador.telefono}
                onChange={(e) =>
                  setTrabajador({
                    ...trabajador,
                    telefono: e.target.value.replace(/\D/g, ''),
                  })
                }
                placeholder="10 dígitos"
                maxLength={10}
                className={`h-11 ${errors['trabajador.telefono'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-blue-500'}`}
              />
              {errors['trabajador.telefono'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['trabajador.telefono']}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sección 2: Datos del Aspirante */}
        <div className="space-y-4 sm:space-y-6 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg sm:rounded-xl p-4 sm:p-5 md:p-6 border border-emerald-200/50 dark:border-emerald-800/50">
          <div className="flex items-center gap-2 sm:gap-3 pb-3 sm:pb-4 border-b border-emerald-200 dark:border-emerald-800">
            <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex-shrink-0">
              <FileUser className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Datos del Aspirante
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                Información de la persona que desea ingresar al IMSS
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            <div className="space-y-2">
              <Label htmlFor="aspirante.nombre" className="text-sm font-semibold">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aspirante.nombre"
                value={aspirante.nombre}
                onChange={(e) =>
                  setAspirante({ ...aspirante, nombre: e.target.value })
                }
                placeholder="Nombre completo"
                className={`h-11 ${errors['aspirante.nombre'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              />
              {errors['aspirante.nombre'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['aspirante.nombre']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspirante.parentesco" className="text-sm font-semibold">
                Parentesco <span className="text-destructive">*</span>
              </Label>
              <Select
                id="aspirante.parentesco"
                value={aspirante.parentesco}
                onChange={(e) =>
                  setAspirante({
                    ...aspirante,
                    parentesco: e.target.value as typeof aspirante.parentesco,
                  })
                }
                className={`h-11 ${errors['aspirante.parentesco'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              >
                {PARENTESCOS.map((parentesco) => (
                  <option key={parentesco} value={parentesco}>
                    {parentesco}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="aspirante.domicilio" className="text-xs sm:text-sm font-semibold">
                Domicilio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aspirante.domicilio"
                value={aspirante.domicilio}
                onChange={(e) =>
                  setAspirante({ ...aspirante, domicilio: e.target.value })
                }
                placeholder="Calle, número, colonia, ciudad"
                className={`h-9 sm:h-10 md:h-11 text-sm ${errors['aspirante.domicilio'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              />
              {errors['aspirante.domicilio'] && (
                <p className="text-xs sm:text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  {errors['aspirante.domicilio']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspirante.curp" className="text-sm font-semibold">CURP</Label>
              <Input
                id="aspirante.curp"
                value={aspirante.curp}
                onChange={(e) =>
                  setAspirante({
                    ...aspirante,
                    curp: e.target.value.toUpperCase(),
                  })
                }
                placeholder="18 caracteres"
                maxLength={18}
                className={`h-11 ${errors['aspirante.curp'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              />
              {errors['aspirante.curp'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['aspirante.curp']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspirante.rfc" className="text-sm font-semibold">RFC</Label>
              <Input
                id="aspirante.rfc"
                value={aspirante.rfc}
                onChange={(e) =>
                  setAspirante({
                    ...aspirante,
                    rfc: e.target.value.toUpperCase(),
                  })
                }
                placeholder="12-13 caracteres"
                maxLength={13}
                className={`h-11 ${errors['aspirante.rfc'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              />
              {errors['aspirante.rfc'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['aspirante.rfc']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspirante.localidadDeseada" className="text-sm font-semibold">
                Localidad Deseada <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aspirante.localidadDeseada"
                value={aspirante.localidadDeseada}
                onChange={(e) =>
                  setAspirante({ ...aspirante, localidadDeseada: e.target.value })
                }
                placeholder="Ciudad o localidad"
                className={`h-11 ${errors['aspirante.localidadDeseada'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              />
              {errors['aspirante.localidadDeseada'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['aspirante.localidadDeseada']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspirante.telefono" className="text-sm font-semibold">
                Teléfono <span className="text-destructive">*</span>
              </Label>
              <Input
                id="aspirante.telefono"
                type="tel"
                value={aspirante.telefono}
                onChange={(e) =>
                  setAspirante({
                    ...aspirante,
                    telefono: e.target.value.replace(/\D/g, ''),
                  })
                }
                placeholder="10 dígitos"
                maxLength={10}
                className={`h-11 ${errors['aspirante.telefono'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              />
              {errors['aspirante.telefono'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['aspirante.telefono']}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aspirante.categoria" className="text-sm font-semibold">
                Categoría a la que aspira <span className="text-destructive">*</span>
              </Label>
              <Select
                id="aspirante.categoria"
                value={aspirante.categoria}
                onChange={(e) =>
                  setAspirante({
                    ...aspirante,
                    categoria: e.target.value as typeof aspirante.categoria,
                  })
                }
                className={`h-11 ${errors['aspirante.categoria'] ? 'border-destructive focus-visible:ring-destructive' : 'focus-visible:ring-emerald-500'}`}
              >
                {CATEGORIAS_ARRAY.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </Select>
              {errors['aspirante.categoria'] && (
                <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors['aspirante.categoria']}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-900/50 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onCancel) {
                onCancel()
              } else if (!isModal) {
                router.back()
              }
            }}
            disabled={loading}
            className="w-full sm:w-auto min-w-[120px] h-10 sm:h-11 text-sm sm:text-base"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto min-w-[180px] h-10 sm:h-11 bg-gradient-to-r from-primary to-red-600 hover:from-primary/90 hover:to-red-600/90 shadow-lg hover:shadow-xl transition-all duration-200 text-sm sm:text-base"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {propuestaId ? 'Actualizar' : 'Guardar'} Propuesta
              </>
            )}
          </Button>
        </div>
      </form>
    </>
  )
}
