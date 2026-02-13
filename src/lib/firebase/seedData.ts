import { createPropuesta } from './propuestas'
import type { TrabajadorActivo, Aspirante } from '@/types/propuestas'
import { CategoriaPropuesta } from '@/types/propuestas'

// Datos de ejemplo para propuestas
const propuestasEjemplo: Array<{
  trabajador: TrabajadorActivo
  aspirante: Aspirante
}> = [
  {
    trabajador: {
      nombre: 'María González Pérez',
      matricula: '12345',
      adscripcion: 'Hospital General Zona 1',
      localidad: 'Ciudad de México',
      antiguedad: '8 años',
      telefono: '5512345678',
    },
    aspirante: {
      nombre: 'Juan González López',
      domicilio: 'Calle Principal 123, Col. Centro, CDMX',
      curp: 'GOLJ950315HDFRZN01',
      rfc: 'GOLJ950315ABC',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Ciudad de México',
      telefono: '5519876543',
      categoria: CategoriaPropuesta.AUX_ENF_GRAL,
    },
  },
  {
    trabajador: {
      nombre: 'Carlos Ramírez Martínez',
      matricula: '23456',
      adscripcion: 'Clínica 25',
      localidad: 'Guadalajara',
      antiguedad: '12 años',
      telefono: '3312345678',
    },
    aspirante: {
      nombre: 'Ana Ramírez Martínez',
      domicilio: 'Av. Revolución 456, Guadalajara, Jalisco',
      curp: 'RAMA920520MJCRZN02',
      rfc: 'RAMA920520XYZ',
      parentesco: 'Cónyuge',
      localidadDeseada: 'Guadalajara',
      telefono: '3319876543',
      categoria: CategoriaPropuesta.ASISTENTE_MEDICA,
    },
  },
  {
    trabajador: {
      nombre: 'Laura Sánchez Hernández',
      matricula: '34567',
      adscripcion: 'Hospital Regional',
      localidad: 'Monterrey',
      antiguedad: '5 años',
      telefono: '8112345678',
    },
    aspirante: {
      nombre: 'Pedro Sánchez Hernández',
      domicilio: 'Blvd. Constitución 789, Monterrey, NL',
      curp: 'SAHP880710HNLRZN03',
      rfc: 'SAHP880710DEF',
      parentesco: 'Hermano(a)',
      localidadDeseada: 'Monterrey',
      telefono: '8119876543',
      categoria: CategoriaPropuesta.AUX_FARMACIA,
    },
  },
  {
    trabajador: {
      nombre: 'Roberto Torres López',
      matricula: '45678',
      adscripcion: 'Unidad Médica Familiar 10',
      localidad: 'Puebla',
      antiguedad: '15 años',
      telefono: '2221234567',
    },
    aspirante: {
      nombre: 'Carmen Torres López',
      domicilio: 'Calle 5 de Mayo 321, Puebla, Puebla',
      curp: 'TOLC900625MPLRZN04',
      rfc: 'TOLC900625GHI',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Puebla',
      telefono: '2229876543',
      categoria: CategoriaPropuesta.TEC_RADIOLOGA,
    },
  },
  {
    trabajador: {
      nombre: 'Patricia Morales García',
      matricula: '56789',
      adscripcion: 'Hospital General',
      localidad: 'Tijuana',
      antiguedad: '10 años',
      telefono: '6641234567',
    },
    aspirante: {
      nombre: 'Fernando Morales García',
      domicilio: 'Av. Revolución 654, Tijuana, BC',
      curp: 'MOGF870415HBCRZN05',
      rfc: 'MOGF870415JKL',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Tijuana',
      telefono: '6649876543',
      categoria: CategoriaPropuesta.AUX_LABORATORIO,
    },
  },
  {
    trabajador: {
      nombre: 'Jorge Hernández Ruiz',
      matricula: '67890',
      adscripcion: 'Clínica 45',
      localidad: 'León',
      antiguedad: '7 años',
      telefono: '4771234567',
    },
    aspirante: {
      nombre: 'Sofía Hernández Ruiz',
      domicilio: 'Calle Madero 987, León, Guanajuato',
      curp: 'HERU920820MGTRZN06',
      rfc: 'HERU920820MNO',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'León',
      telefono: '4779876543',
      categoria: CategoriaPropuesta.ENFERMERA_GRAL,
    },
  },
  {
    trabajador: {
      nombre: 'Ana Martínez Díaz',
      matricula: '78901',
      adscripcion: 'Hospital Regional',
      localidad: 'Mérida',
      antiguedad: '9 años',
      telefono: '9991234567',
    },
    aspirante: {
      nombre: 'Luis Martínez Díaz',
      domicilio: 'Calle 60 #123, Mérida, Yucatán',
      curp: 'MADL850525HYNRZN07',
      rfc: 'MADL850525PQR',
      parentesco: 'Cónyuge',
      localidadDeseada: 'Mérida',
      telefono: '9999876543',
      categoria: CategoriaPropuesta.MEDICO_GENERAL,
    },
  },
  {
    trabajador: {
      nombre: 'Miguel Ángel Flores Castro',
      matricula: '89012',
      adscripcion: 'Unidad Médica Familiar 20',
      localidad: 'Querétaro',
      antiguedad: '6 años',
      telefono: '4421234567',
    },
    aspirante: {
      nombre: 'Elena Flores Castro',
      domicilio: 'Av. Corregidora 456, Querétaro, Qro',
      curp: 'FOCE910630MQRRZN08',
      rfc: 'FOCE910630STU',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Querétaro',
      telefono: '4429876543',
      categoria: CategoriaPropuesta.AUX_TRABAJO_SOCIAL,
    },
  },
  {
    trabajador: {
      nombre: 'Carmen López Vázquez',
      matricula: '90123',
      adscripcion: 'Hospital General',
      localidad: 'Toluca',
      antiguedad: '11 años',
      telefono: '7221234567',
    },
    aspirante: {
      nombre: 'Diego López Vázquez',
      domicilio: 'Calle Hidalgo 789, Toluca, Estado de México',
      curp: 'LOVD880715HMCRZN09',
      rfc: 'LOVD880715VWX',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Toluca',
      telefono: '7229876543',
      categoria: CategoriaPropuesta.CHOFER,
    },
  },
  {
    trabajador: {
      nombre: 'Francisco Javier Ruiz Mendoza',
      matricula: '01234',
      adscripcion: 'Clínica 30',
      localidad: 'Aguascalientes',
      antiguedad: '13 años',
      telefono: '4491234567',
    },
    aspirante: {
      nombre: 'Valeria Ruiz Mendoza',
      domicilio: 'Blvd. López Mateos 321, Aguascalientes, Ags',
      curp: 'RUMV930820MAGRNZ10',
      rfc: 'RUMV930820YZA',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Aguascalientes',
      telefono: '4499876543',
      categoria: CategoriaPropuesta.PSICOLOGO,
    },
  },
  {
    trabajador: {
      nombre: 'Gabriela Silva Torres',
      matricula: '11223',
      adscripcion: 'Hospital Regional',
      localidad: 'Chihuahua',
      antiguedad: '4 años',
      telefono: '6141234567',
    },
    aspirante: {
      nombre: 'Ricardo Silva Torres',
      domicilio: 'Calle Libertad 654, Chihuahua, Chih',
      curp: 'SITR900410HCHRZN11',
      rfc: 'SITR900410BCD',
      parentesco: 'Cónyuge',
      localidadDeseada: 'Chihuahua',
      telefono: '6149876543',
      categoria: CategoriaPropuesta.NUTRICIONISTA_DIETISTA,
    },
  },
  {
    trabajador: {
      nombre: 'Daniel Mendoza Herrera',
      matricula: '22334',
      adscripcion: 'Unidad Médica Familiar 15',
      localidad: 'Morelia',
      antiguedad: '8 años',
      telefono: '4431234567',
    },
    aspirante: {
      nombre: 'Isabella Mendoza Herrera',
      domicilio: 'Av. Madero 987, Morelia, Michoacán',
      curp: 'MEHI920625MMCRZN12',
      rfc: 'MEHI920625EFG',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Morelia',
      telefono: '4439876543',
      categoria: CategoriaPropuesta.AUX_SERV_ADMTVOS,
    },
  },
  {
    trabajador: {
      nombre: 'Sandra Jiménez Castro',
      matricula: '33445',
      adscripcion: 'Hospital General',
      localidad: 'Saltillo',
      antiguedad: '14 años',
      telefono: '8441234567',
    },
    aspirante: {
      nombre: 'Andrés Jiménez Castro',
      domicilio: 'Calle Juárez 123, Saltillo, Coahuila',
      curp: 'JICA870320HCSRZN13',
      rfc: 'JICA870320HIJ',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Saltillo',
      telefono: '8449876543',
      categoria: CategoriaPropuesta.OP_AMBULANCIAS,
    },
  },
  {
    trabajador: {
      nombre: 'Luis Fernando Vargas Ríos',
      matricula: '44556',
      adscripcion: 'Clínica 50',
      localidad: 'Hermosillo',
      antiguedad: '6 años',
      telefono: '6621234567',
    },
    aspirante: {
      nombre: 'Mariana Vargas Ríos',
      domicilio: 'Blvd. Kino 456, Hermosillo, Sonora',
      curp: 'VARM910415MSNRZN14',
      rfc: 'VARM910415KLM',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Hermosillo',
      telefono: '6629876543',
      categoria: CategoriaPropuesta.TEC_POLIVALENTE,
    },
  },
  {
    trabajador: {
      nombre: 'Verónica Castro Medina',
      matricula: '55667',
      adscripcion: 'Hospital Regional',
      localidad: 'Xalapa',
      antiguedad: '10 años',
      telefono: '2281234567',
    },
    aspirante: {
      nombre: 'Alejandro Castro Medina',
      domicilio: 'Calle Enríquez 789, Xalapa, Veracruz',
      curp: 'CAMA890510HVLRZN15',
      rfc: 'CAMA890510NOP',
      parentesco: 'Hijo(a)',
      localidadDeseada: 'Xalapa',
      telefono: '2289876543',
      categoria: CategoriaPropuesta.ESTOMATOLOGO,
    },
  },
]

/**
 * Función para poblar la base de datos con propuestas de ejemplo
 * @param userId - ID del usuario que creará las propuestas
 * @param userEmail - Email del usuario (opcional)
 * @returns Número de propuestas creadas
 */
export const seedPropuestas = async (
  userId: string,
  userEmail?: string
): Promise<number> => {
  let creadas = 0
  const errores: string[] = []

  for (const propuesta of propuestasEjemplo) {
    try {
      await createPropuesta(
        propuesta.trabajador,
        propuesta.aspirante,
        userId,
        userEmail
      )
      creadas++
    } catch (error: any) {
      console.error(
        `Error creando propuesta para ${propuesta.trabajador.nombre}:`,
        error
      )
      errores.push(
        `${propuesta.trabajador.nombre}: ${error.message || 'Error desconocido'}`
      )
    }
  }

  if (errores.length > 0) {
    console.warn('Errores al crear algunas propuestas:', errores)
  }

  return creadas
}
