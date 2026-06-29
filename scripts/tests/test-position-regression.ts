import assert from 'node:assert/strict'
import { calcularPosiciones } from '../../src/lib/bolsa-de-trabajo/calculos'
import type { BolsaDeTrabajoRegistro } from '../../src/types/bolsa-de-trabajo'

function registro(partial: Partial<BolsaDeTrabajoRegistro>): BolsaDeTrabajoRegistro {
  return {
    id: partial.id || `${partial.tipoDocumento || 'TEST'}-${partial.matricula || Math.random()}`,
    tipoDocumento: partial.tipoDocumento || 'NUEVO_INGRESO',
    ...partial,
  }
}

function testNuevoIngreso() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '1', matricula: 'M001', nombre: 'Juan', categoria: 'AUX', zona: 'Z1', tipoContratacion: '2' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '2', matricula: 'M002', nombre: 'Maria', categoria: 'AUX', zona: 'Z1', tipoContratacion: '2' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '3', matricula: 'M003', nombre: 'Pedro', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '4', matricula: 'M004', nombre: 'Ana', categoria: 'AUX', zona: 'Z1', tipoContratacion: '2' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '5', matricula: 'M005', nombre: 'Luis', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '6', matricula: 'M006', nombre: 'Rosa', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }),
  ]

  const pedro = calcularPosiciones(registros, 'M003', 'NUEVO_INGRESO')
  assert.ok(pedro)
  assert.equal(pedro.posicionBase, 3)
  assert.equal(pedro.posicionInterinato, 1)
  assert.equal(pedro.totalEnCategoria, 6)
  assert.equal(pedro.totalEventualesEnCategoria, 3)

  const ana = calcularPosiciones(registros, 'M004', 'NUEVO_INGRESO')
  assert.ok(ana)
  assert.equal(ana.posicionBase, 4)
  assert.equal(ana.posicionInterinato, undefined)
  assert.equal(ana.totalEnCategoria, 6)
  assert.equal(ana.totalEventualesEnCategoria, 3)

  console.log('OK NUEVO_INGRESO mantiene posicion base e interinato')
}

function testNuevoIngresoDeduplicaPorMatricula() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '10', matricula: 'M010', nombre: 'Primero', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '11', matricula: 'M010', nombre: 'Duplicado', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '12', matricula: 'M011', nombre: 'Segundo', categoria: 'AUX', zona: 'Z1', tipoContratacion: '2' }),
    registro({ tipoDocumento: 'NUEVO_INGRESO', numeroProg: '13', matricula: 'M012', nombre: 'Tercero', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }),
  ]

  const primero = calcularPosiciones(registros, 'M010', 'NUEVO_INGRESO')
  assert.ok(primero)
  assert.equal(primero.nombre, 'Primero')
  assert.equal(primero.posicionBase, 1)
  assert.equal(primero.posicionInterinato, 1)
  assert.equal(primero.totalEnCategoria, 3)
  assert.equal(primero.totalEventualesEnCategoria, 2)

  const tercero = calcularPosiciones(registros, 'M012', 'NUEVO_INGRESO')
  assert.ok(tercero)
  assert.equal(tercero.posicionBase, 3)
  assert.equal(tercero.posicionInterinato, 2)

  console.log('OK NUEVO_INGRESO deduplica por matricula y conserva el primer consecutivo')
}

function testNuevoIngresoFiltraPorSubcategoria() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({
      tipoDocumento: 'NUEVO_INGRESO',
      numeroProg: '1',
      matricula: 'NM001',
      nombre: 'Angiologia 1',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
      zona: 'Z1',
      tipoContratacion: '2',
    }),
    registro({
      tipoDocumento: 'NUEVO_INGRESO',
      numeroProg: '2',
      matricula: 'NM002',
      nombre: 'Cardiologia 1',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '14 CARDIOLOGIA',
      zona: 'Z1',
      tipoContratacion: '2',
    }),
    registro({
      tipoDocumento: 'NUEVO_INGRESO',
      numeroProg: '3',
      matricula: 'NM003',
      nombre: 'Angiologia 2',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
      zona: 'Z1',
      tipoContratacion: '8',
    }),
    registro({
      tipoDocumento: 'NUEVO_INGRESO',
      numeroProg: '4',
      matricula: 'NM004',
      nombre: 'Cardiologia 2',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '14 CARDIOLOGIA',
      zona: 'Z1',
      tipoContratacion: '8',
    }),
  ]

  const angiologia = calcularPosiciones(registros, 'NM003', 'NUEVO_INGRESO')
  assert.ok(angiologia)
  assert.equal(angiologia.posicionBase, 2)
  assert.equal(angiologia.totalEnCategoria, 2)
  assert.equal(angiologia.posicionInterinato, 1)
  assert.equal(angiologia.totalEventualesEnCategoria, 1)
  assert.deepEqual(angiologia.grupoComparable, {
    zona: 'Z1',
    categoria: '203601 - MEDICO NO FAMILIAR',
    subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
  })

  const cardiologia = calcularPosiciones(registros, 'NM004', 'NUEVO_INGRESO')
  assert.ok(cardiologia)
  assert.equal(cardiologia.posicionBase, 2)
  assert.equal(cardiologia.totalEnCategoria, 2)
  assert.equal(cardiologia.posicionInterinato, 1)
  assert.equal(cardiologia.totalEventualesEnCategoria, 1)

  console.log('OK NUEVO_INGRESO filtra por subcategoria cuando existe grupo')
}

function testCambiosTurnoAdscripcion() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION', numeroProg: '9', matricula: 'C003', nombre: 'Tercero', categoria: 'MED', zona: 'Z2', registro: 'CAT', adscripcionNueva: 'UMF1', turnoNuevo: 'MAT' }),
    registro({ tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION', numeroProg: '2', matricula: 'C001', nombre: 'Primero', categoria: 'MED', zona: 'Z2', registro: 'CAT', adscripcionNueva: 'UMF1', turnoNuevo: 'MAT' }),
    registro({ tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION', numeroProg: '5', matricula: 'C002', nombre: 'Segundo', categoria: 'MED', zona: 'Z2', registro: 'CAT', adscripcionNueva: 'UMF1', turnoNuevo: 'MAT' }),
  ]

  const segundo = calcularPosiciones(registros, 'C002', 'CAMBIOS_TURNO_ADSCRIPCION')
  assert.ok(segundo)
  assert.equal(segundo.posicionBase, 2)
  assert.equal(segundo.totalEnCategoria, 3)
  assert.equal(segundo.adscripcionNueva, 'UMF1')
  assert.equal(segundo.turnoNuevo, 'MAT')

  console.log('OK CAMBIOS_TURNO_ADSCRIPCION ordena por consecutivo en el grupo comparable')
}

function testCambiosTurnoAdscripcionConservaMultiplesTramitesPorMatricula() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ id: 'cat-1', tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION', numeroProg: '1', matricula: 'CAT01', nombre: 'Primero', categoria: 'MED', zona: 'Z2', registro: 'CAT', adscripcionNueva: 'UMF1', turnoNuevo: 'VES' }),
    registro({ id: 'cat-2', tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION', numeroProg: '4', matricula: 'CAT01', nombre: 'Segundo tramite', categoria: 'MED', zona: 'Z2', registro: 'CAT', adscripcionNueva: 'UMF1', turnoNuevo: 'VES' }),
    registro({ id: 'cat-3', tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION', numeroProg: '6', matricula: 'CAT02', nombre: 'Tercero', categoria: 'MED', zona: 'Z2', registro: 'CAT', adscripcionNueva: 'UMF1', turnoNuevo: 'VES' }),
  ]

  const primerTramite = calcularPosiciones(registros, 'CAT01', 'CAMBIOS_TURNO_ADSCRIPCION', {
    targetRecordId: 'cat-1',
  })
  assert.ok(primerTramite)
  assert.equal(primerTramite.recordId, 'cat-1')
  assert.equal(primerTramite.nombre, 'Primero')
  assert.equal(primerTramite.posicionBase, 1)
  assert.equal(primerTramite.totalEnCategoria, 3)

  const segundoTramite = calcularPosiciones(registros, 'CAT01', 'CAMBIOS_TURNO_ADSCRIPCION', {
    targetRecordId: 'cat-2',
  })
  assert.ok(segundoTramite)
  assert.equal(segundoTramite.recordId, 'cat-2')
  assert.equal(segundoTramite.nombre, 'Segundo tramite')
  assert.equal(segundoTramite.posicionBase, 2)
  assert.equal(segundoTramite.totalEnCategoria, 3)

  console.log('OK CAMBIOS_TURNO_ADSCRIPCION conserva multiples tramites del mismo trabajador')
}

function testCambiosTurnoAdscripcionFiltraPorSubcategoria() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({
      tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
      numeroProg: '1',
      matricula: 'CTA001',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
      zona: 'Z1',
      registro: 'CAT',
      adscripcionNueva: 'UMF1',
      turnoNuevo: 'MAT',
    }),
    registro({
      tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
      numeroProg: '2',
      matricula: 'CTA002',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '14 CARDIOLOGIA',
      zona: 'Z1',
      registro: 'CAT',
      adscripcionNueva: 'UMF1',
      turnoNuevo: 'MAT',
    }),
    registro({
      tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
      numeroProg: '3',
      matricula: 'CTA003',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
      zona: 'Z1',
      registro: 'CAT',
      adscripcionNueva: 'UMF1',
      turnoNuevo: 'MAT',
    }),
  ]

  const resultado = calcularPosiciones(registros, 'CTA003', 'CAMBIOS_TURNO_ADSCRIPCION')
  assert.ok(resultado)
  assert.equal(resultado.posicionBase, 2)
  assert.equal(resultado.totalEnCategoria, 2)
  assert.equal(resultado.grupoComparable?.subcategoria, '11 ANGIOLOGIA Y CIRUGIA VASCULAR')

  console.log('OK CAMBIOS_TURNO_ADSCRIPCION separa por subcategoria cuando existe')
}

function testCambiosTurnoAdscripcionFiltraPorTurnoEnCad() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({
      tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
      numeroProg: '1',
      matricula: 'CTACAD001',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '32 PEDIATRIA',
      zona: 'Z1',
      registro: 'CAD',
      adscripcionNueva: '02HA200000',
      turnoNuevo: 'MAT',
    }),
    registro({
      tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
      numeroProg: '2',
      matricula: 'CTACAD002',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '32 PEDIATRIA',
      zona: 'Z1',
      registro: 'CAD',
      adscripcionNueva: '02HA200000',
      turnoNuevo: 'JACUM',
    }),
    registro({
      tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION',
      numeroProg: '3',
      matricula: 'CTACAD003',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '32 PEDIATRIA',
      zona: 'Z1',
      registro: 'CAD',
      adscripcionNueva: '02HA200000',
      turnoNuevo: 'JACUM',
    }),
  ]

  const resultado = calcularPosiciones(registros, 'CTACAD003', 'CAMBIOS_TURNO_ADSCRIPCION')
  assert.ok(resultado)
  assert.equal(resultado.posicionBase, 2)
  assert.equal(resultado.totalEnCategoria, 2)
  assert.equal(resultado.grupoComparable?.turnoNuevo, 'JACUM')

  console.log('OK CAMBIOS_TURNO_ADSCRIPCION separa por turno cuando CAD trae turno solicitado')
}

function testMatriculaInexistente() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'CAMBIOS_TURNO_ADSCRIPCION', numeroProg: '1', matricula: 'A1', categoria: 'MED', zona: 'Z1' }),
  ]

  const resultado = calcularPosiciones(registros, 'NO_EXISTE', 'CAMBIOS_TURNO_ADSCRIPCION')
  assert.equal(resultado, null)

  console.log('OK retorna null cuando la matricula no existe en el grupo')
}

function testCambiosArea() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'CAMBIOS_AREA', numeroProg: '7', matricula: 'A003', nombre: 'Tercero', categoria: 'ENF', zona: 'Z3' }),
    registro({ tipoDocumento: 'CAMBIOS_AREA', numeroProg: '1', matricula: 'A001', nombre: 'Primero', categoria: 'ENF', zona: 'Z3' }),
    registro({ tipoDocumento: 'CAMBIOS_AREA', numeroProg: '4', matricula: 'A002', nombre: 'Segundo', categoria: 'ENF', zona: 'Z3' }),
  ]

  const segundo = calcularPosiciones(registros, 'A002', 'CAMBIOS_AREA')
  assert.ok(segundo)
  assert.equal(segundo.posicionBase, 2)
  assert.equal(segundo.totalEnCategoria, 3)
  assert.equal(segundo.grupoComparable?.zona, 'Z3')
  assert.equal(segundo.grupoComparable?.categoria, 'ENF')

  console.log('OK CAMBIOS_AREA usa zona + categoria y ordena por consecutivo')
}

function testCambiosTipoPlaza() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'CAMBIOS_TIPO_PLAZA', numeroProg: '3', matricula: 'P002', nombre: 'Segundo', categoria: 'LAB', zona: 'Z4' }),
    registro({ tipoDocumento: 'CAMBIOS_TIPO_PLAZA', numeroProg: '2', matricula: 'P001', nombre: 'Primero', categoria: 'LAB', zona: 'Z4' }),
  ]

  const segundo = calcularPosiciones(registros, 'P002', 'CAMBIOS_TIPO_PLAZA')
  assert.ok(segundo)
  assert.equal(segundo.posicionBase, 2)
  assert.equal(segundo.totalEnCategoria, 2)
  assert.equal(segundo.grupoComparable?.zona, 'Z4')
  assert.equal(segundo.grupoComparable?.categoria, 'LAB')

  console.log('OK CAMBIOS_TIPO_PLAZA usa zona + categoria y ordena por consecutivo')
}

function testCambiosResidenciaOrigen() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'CAMBIOS_RESIDENCIA_ORIGEN', numeroProg: '8', matricula: 'R003', nombre: 'Tercero', zona: 'Z5', categoria: 'ENF', turnoNuevo: 'MAT' }),
    registro({ tipoDocumento: 'CAMBIOS_RESIDENCIA_ORIGEN', numeroProg: '2', matricula: 'R001', nombre: 'Primero', zona: 'Z5', categoria: 'ENF', turnoNuevo: 'MAT' }),
    registro({ tipoDocumento: 'CAMBIOS_RESIDENCIA_ORIGEN', numeroProg: '5', matricula: 'R002', nombre: 'Segundo', zona: 'Z5', categoria: 'ENF', turnoNuevo: 'MAT' }),
  ]

  const segundo = calcularPosiciones(registros, 'R002', 'CAMBIOS_RESIDENCIA_ORIGEN')
  assert.ok(segundo)
  assert.equal(segundo.posicionBase, 2)
  assert.equal(segundo.totalEnCategoria, 3)
  assert.equal(segundo.grupoComparable?.zona, 'Z5')
  assert.equal(segundo.grupoComparable?.categoria, 'ENF')
  assert.equal(segundo.grupoComparable?.turnoNuevo, 'MAT')

  console.log('OK CAMBIOS_RESIDENCIA_ORIGEN usa zona + categoria + turno y ordena por consecutivo')
}

function testCambiosResidenciaDestino() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO', numeroProg: '6', matricula: 'D002', nombre: 'Segundo', zona: 'Z6', categoria: 'ENF', turnoNuevo: 'VES' }),
    registro({ tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO', numeroProg: '1', matricula: 'D001', nombre: 'Primero', zona: 'Z6', categoria: 'ENF', turnoNuevo: 'VES' }),
  ]

  const segundo = calcularPosiciones(registros, 'D002', 'CAMBIOS_RESIDENCIA_DESTINO')
  assert.ok(segundo)
  assert.equal(segundo.posicionBase, 2)
  assert.equal(segundo.totalEnCategoria, 2)
  assert.equal(segundo.grupoComparable?.zona, 'Z6')
  assert.equal(segundo.grupoComparable?.categoria, 'ENF')
  assert.equal(segundo.grupoComparable?.turnoNuevo, 'VES')

  console.log('OK CAMBIOS_RESIDENCIA_DESTINO usa zona + categoria + turno y ordena por consecutivo')
}

function testCambiosResidenciaFiltraPorSubcategoria() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({
      tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO',
      numeroProg: '1',
      matricula: 'RD001',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
      zona: 'Z1',
      cambioSolicitado: 'Mat',
    }),
    registro({
      tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO',
      numeroProg: '2',
      matricula: 'RD002',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '14 CARDIOLOGIA',
      zona: 'Z1',
      cambioSolicitado: 'Mat',
    }),
    registro({
      tipoDocumento: 'CAMBIOS_RESIDENCIA_DESTINO',
      numeroProg: '3',
      matricula: 'RD003',
      categoria: '203601 - MEDICO NO FAMILIAR',
      subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
      zona: 'Z1',
      cambioSolicitado: 'Mat',
    }),
  ]

  const resultado = calcularPosiciones(registros, 'RD003', 'CAMBIOS_RESIDENCIA_DESTINO')
  assert.ok(resultado)
  assert.equal(resultado.posicionBase, 2)
  assert.equal(resultado.totalEnCategoria, 2)
  assert.deepEqual(resultado.grupoComparable, {
    zona: 'Z1',
    categoria: '203601 - MEDICO NO FAMILIAR',
    subcategoria: '11 ANGIOLOGIA Y CIRUGIA VASCULAR',
    turnoNuevo: 'MAT',
  })

  console.log('OK CAMBIOS_RESIDENCIA separa por subcategoria cuando existe')
}

function testAmpliacionesJornada() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'AMPLIACIONES_JORNADA', numeroProg: '9', matricula: 'J003', nombre: 'Tercero', categoria: 'ENF', jornadaNueva: '8', adscripcionNueva: 'UMF10', turnoNuevo: 'MAT' }),
    registro({ tipoDocumento: 'AMPLIACIONES_JORNADA', numeroProg: '2', matricula: 'J001', nombre: 'Primero', categoria: 'ENF', jornadaNueva: '8', adscripcionNueva: 'UMF10', turnoNuevo: 'MAT' }),
    registro({ tipoDocumento: 'AMPLIACIONES_JORNADA', numeroProg: '5', matricula: 'J002', nombre: 'Segundo', categoria: 'ENF', jornadaNueva: '8', adscripcionNueva: 'UMF10', turnoNuevo: 'MAT' }),
    registro({ tipoDocumento: 'AMPLIACIONES_JORNADA', numeroProg: '1', matricula: 'J004', nombre: 'Otra categoria', categoria: 'MED', jornadaNueva: '8', adscripcionNueva: 'UMF10', turnoNuevo: 'MAT' }),
  ]

  const segundo = calcularPosiciones(registros, 'J002', 'AMPLIACIONES_JORNADA')
  assert.ok(segundo)
  assert.equal(segundo.posicionBase, 2)
  assert.equal(segundo.totalEnCategoria, 3)
  assert.equal(segundo.grupoComparable?.categoria, 'ENF')
  assert.equal(segundo.grupoComparable?.adscripcionNueva, 'UMF10')
  assert.equal(segundo.grupoComparable?.turnoNuevo, 'MAT')

  console.log('OK AMPLIACIONES_JORNADA usa categoria + adscripcion solicitada + turno y ordena por consecutivo')
}

function testCambiosRamaCuentaPorZona() {
  const registros: BolsaDeTrabajoRegistro[] = [
    registro({ tipoDocumento: 'CAMBIOS_RAMA', numeroProg: '5', matricula: 'R001', nombre: 'Zona', categoria: 'MED', zona: 'TIJUANA' }),
    registro({ tipoDocumento: 'CAMBIOS_RAMA', numeroProg: '8', matricula: 'R002', nombre: 'Zona2', categoria: 'MED', zona: 'TIJUANA' }),
    registro({ tipoDocumento: 'CAMBIOS_RAMA', numeroProg: '20', matricula: 'R003', nombre: 'Incondicional', categoria: 'MED', zona: 'INCONDICIONAL' }),
    registro({ tipoDocumento: 'CAMBIOS_RAMA', numeroProg: '2', matricula: 'R004', nombre: 'OtraZona', categoria: 'MED', zona: 'MEXICALI' }),
  ]

  // La zona especifica cuenta SOLO contra su misma zona: los incondicionales no suman.
  const zona = calcularPosiciones(registros, 'R001', 'CAMBIOS_RAMA')
  assert.ok(zona)
  assert.equal(zona.posicionBase, 1)
  assert.equal(zona.totalEnCategoria, 2)

  // Los incondicionales (zona 0) son su propio grupo, separados de las zonas.
  const incondicional = calcularPosiciones(registros, 'R003', 'CAMBIOS_RAMA')
  assert.ok(incondicional)
  assert.equal(incondicional.posicionBase, 1)
  assert.equal(incondicional.totalEnCategoria, 1)

  console.log('OK CAMBIOS_RAMA cuenta la posicion por zona, sin mezclar incondicionales')
}

function main() {
  testNuevoIngreso()
  testNuevoIngresoDeduplicaPorMatricula()
  testNuevoIngresoFiltraPorSubcategoria()
  testCambiosTurnoAdscripcion()
  testCambiosTurnoAdscripcionConservaMultiplesTramitesPorMatricula()
  testCambiosTurnoAdscripcionFiltraPorSubcategoria()
  testCambiosTurnoAdscripcionFiltraPorTurnoEnCad()
  testCambiosArea()
  testCambiosTipoPlaza()
  testCambiosResidenciaOrigen()
  testCambiosResidenciaDestino()
  testCambiosResidenciaFiltraPorSubcategoria()
  testAmpliacionesJornada()
  testCambiosRamaCuentaPorZona()
  testMatriculaInexistente()
  console.log('\nTodas las regresiones de posiciones pasaron')
}

main()
