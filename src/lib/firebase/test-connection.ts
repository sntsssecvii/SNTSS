/**
 * Script de prueba directa de conexión a Firestore
 * Ejecutar desde consola del navegador: window.testFirestoreConnection()
 */

import { db } from './firebase-client'
import { doc, getDoc, enableNetwork } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

export const testFirestoreConnection = async () => {
  console.log('🔍 TEST DIRECTO DE FIRESTORE')
  console.log('============================')
  console.log('')

  const auth = getAuth()
  const user = auth.currentUser

  if (!user) {
    console.error('❌ No hay usuario autenticado')
    return
  }

  console.log('✅ Usuario autenticado:', user.email)
  console.log('✅ UID:', user.uid)
  console.log('')

  try {
    console.log('1️⃣  Forzando conexión online...')
    await enableNetwork(db)
    console.log('✅ Conexión online habilitada')
    console.log('')

    console.log('2️⃣  Intentando leer documento...')
    console.log(`   Ruta: usuarios/${user.uid}`)

    const startTime = Date.now()
    const userDocRef = doc(db, 'usuarios', user.uid)

    console.log('   📡 Ejecutando getDoc()...')
    const userDoc = await getDoc(userDocRef)
    const elapsedTime = Date.now() - startTime

    console.log(`   ⏱️  Tiempo: ${elapsedTime}ms`)
    console.log('')

    if (userDoc.exists()) {
      console.log('✅ ¡ÉXITO! Documento encontrado')
      console.log('📋 Datos:', userDoc.data())
    } else {
      console.error('❌ Documento NO existe')
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message)
    console.error('   Código:', error.code)
    console.error('   Stack:', error.stack)
  }
}

if (typeof window !== 'undefined') {
  (window as any).testFirestoreConnection = testFirestoreConnection
}
