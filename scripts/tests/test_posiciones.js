import { calcularPosiciones } from '../../src/lib/bolsa-de-trabajo/calculos.js'

// Mock de registros basados en el ejemplo del usuario
const mockRegistros = [
    { numeroProg: '1', matricula: 'M001', nombre: 'Juan', categoria: 'AUX', zona: 'Z1', tipoContratacion: '2' }, // Interinato
    { numeroProg: '2', matricula: 'M002', nombre: 'Maria', categoria: 'AUX', zona: 'Z1', tipoContratacion: '2' }, // Interinato
    { numeroProg: '3', matricula: 'M003', nombre: 'Pedro', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }, // Eventual (Pos Interinato: 1)
    { numeroProg: '4', matricula: 'M004', nombre: 'Ana', categoria: 'AUX', zona: 'Z1', tipoContratacion: '2' },  // Interinato
    { numeroProg: '5', matricula: 'M005', nombre: 'Luis', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }, // Eventual (Pos Interinato: 2)
    { numeroProg: '6', matricula: 'M006', nombre: 'Rosa', categoria: 'AUX', zona: 'Z1', tipoContratacion: '8' }, // Eventual (Pos Interinato: 3)
]

function testCalculos() {
    console.log('--- Iniciando Test de Cálculos de Posición ---')

    // Caso 1: Pedro (Eventual en la posición progresiva 3)
    console.log('\nCaso 1: Pedro (Matrícula M003, Eventual)')
    const resPedro = calcularPosiciones(mockRegistros, 'M003')
    if (resPedro) {
        console.log(`✅ Posición Base: ${resPedro.posicionBase} (Esperado: 3)`)
        console.log(`✅ Posición Interinato: ${resPedro.posicionInterinato} (Esperado: 1)`)
    } else {
        console.error('❌ No se encontró a Pedro')
    }

    // Caso 2: Luis (Eventual en la posición progresiva 5)
    console.log('\nCaso 2: Luis (Matrícula M005, Eventual)')
    const resLuis = calcularPosiciones(mockRegistros, 'M005')
    if (resLuis) {
        console.log(`✅ Posición Base: ${resLuis.posicionBase} (Esperado: 5)`)
        console.log(`✅ Posición Interinato: ${resLuis.posicionInterinato} (Esperado: 2)`)
    } else {
        console.error('❌ No se encontró a Luis')
    }

    // Caso 3: Ana (Interinato en la posición progresiva 4)
    console.log('\nCaso 3: Ana (Matrícula M004, Interinato)')
    const resAna = calcularPosiciones(mockRegistros, 'M004')
    if (resAna) {
        console.log(`✅ Posición Base: ${resAna.posicionBase} (Esperado: 4)`)
        console.log(`✅ Posición Interinato: ${resAna.posicionInterinato} (Esperado: undefined)`)
    } else {
        console.error('❌ No se encontró a Ana')
    }

    console.log('\n--- Test Finalizado ---')
}

testCalculos()
