import jsPDF from 'jspdf'
import type { Propuesta } from '@/types/propuestas'
import { format } from 'date-fns'

// Función para convertir imagen a base64 (para usar en PDF)
const convertirImagenABase64 = async (src: string): Promise<string> => {
  try {
    const response = await fetch(src)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error convirtiendo imagen:', error)
    return ''
  }
}

export const descargarPropuestaPDF = async (propuesta: Propuesta): Promise<void> => {
  const doc = new jsPDF('p', 'mm', 'letter')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let yPos = margin

  // Función helper para agregar texto con wrap
  const agregarTexto = (
    texto: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number = 10,
    align: 'left' | 'center' | 'right' = 'left'
  ): number => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(texto, maxWidth)
    doc.text(lines, x, y, { align })
    return y + lines.length * (fontSize * 0.4)
  }

  // Encabezado con logos
  try {
    // Intentar cargar logos (si están disponibles)
    // Nota: En producción, estos deberían estar en la carpeta public
    const logoSNTSS = await convertirImagenABase64('/src/assets/logo-sntss.png').catch(() => '')
    const logoSeccion7 = await convertirImagenABase64('/src/assets/seccion7.png').catch(() => '')

    if (logoSNTSS) {
      doc.addImage(logoSNTSS, 'PNG', margin, yPos, 40, 20)
    }
    if (logoSeccion7) {
      doc.addImage(logoSeccion7, 'PNG', pageWidth - margin - 30, yPos, 30, 30)
    }
  } catch (error) {
    console.warn('No se pudieron cargar los logos:', error)
  }

  yPos = 50

  // Título
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('PROPUESTA SINDICAL', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Sección VII - SNTSS', pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  // Fecha de emisión
  const fechaEmision = propuesta.fechaCreacion
    ? format(
        propuesta.fechaCreacion instanceof Date
          ? propuesta.fechaCreacion
          : new Date(propuesta.fechaCreacion),
        "dd 'de' MMMM 'de' yyyy"
      )
    : format(new Date(), "dd 'de' MMMM 'de' yyyy")

  doc.setFontSize(10)
  doc.text(`Fecha de emisión: ${fechaEmision}`, pageWidth - margin, yPos, { align: 'right' })
  yPos += 15

  // Línea separadora
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // Sección: Datos del Trabajador Activo
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL TRABAJADOR ACTIVO', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const trabajador = propuesta.trabajadorActivo
  const datosTrabajador = [
    { label: 'Nombre:', value: trabajador.nombre },
    { label: 'Matrícula:', value: trabajador.matricula },
    { label: 'Adscripción:', value: trabajador.adscripcion },
    { label: 'Localidad:', value: trabajador.localidad },
    { label: 'Antigüedad:', value: trabajador.antiguedad },
    { label: 'Teléfono:', value: trabajador.telefono },
  ]

  datosTrabajador.forEach((dato) => {
    doc.setFont('helvetica', 'bold')
    doc.text(dato.label, margin, yPos)
    doc.setFont('helvetica', 'normal')
    yPos = agregarTexto(dato.value, margin + 40, yPos, pageWidth - margin - 50)
    yPos += 5
  })

  yPos += 5

  // Verificar si necesitamos nueva página
  if (yPos > pageHeight - 60) {
    doc.addPage()
    yPos = margin
  }

  // Línea separadora
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // Sección: Datos del Aspirante
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL ASPIRANTE', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const aspirante = propuesta.aspirante
  const datosAspirante = [
    { label: 'Nombre:', value: aspirante.nombre },
    { label: 'Parentesco:', value: aspirante.parentesco },
    { label: 'Domicilio:', value: aspirante.domicilio },
    { label: 'CURP:', value: aspirante.curp || 'No proporcionado' },
    { label: 'RFC:', value: aspirante.rfc || 'No proporcionado' },
    { label: 'Localidad Deseada:', value: aspirante.localidadDeseada },
    { label: 'Teléfono:', value: aspirante.telefono },
    { label: 'Categoría a la que aspira:', value: aspirante.categoria },
  ]

  datosAspirante.forEach((dato) => {
    doc.setFont('helvetica', 'bold')
    doc.text(dato.label, margin, yPos)
    doc.setFont('helvetica', 'normal')
    yPos = agregarTexto(dato.value, margin + 50, yPos, pageWidth - margin - 60)
    yPos += 5
  })

  yPos += 15

  // Verificar si necesitamos nueva página para la firma
  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = margin
  }

  // Línea separadora
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 15

  // Área de firma
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Firma y sello del responsable', margin, yPos)
  yPos += 20

  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 5

  doc.setFontSize(8)
  doc.text('Sección VII - SNTSS', pageWidth / 2, yPos, { align: 'center' })
  yPos += 3
  doc.text('Sistema de Gestión de Propuestas', pageWidth / 2, yPos, { align: 'center' })

  // Generar nombre del archivo
  const nombreArchivo = `Propuesta_${trabajador.matricula}_${format(
    propuesta.fechaCreacion instanceof Date
      ? propuesta.fechaCreacion
      : new Date(propuesta.fechaCreacion),
    'yyyy-MM-dd'
  )}.pdf`

  // Descargar PDF
  doc.save(nombreArchivo)
}
