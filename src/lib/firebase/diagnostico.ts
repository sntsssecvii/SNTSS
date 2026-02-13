/**
 * Función de diagnóstico para verificar el estado de Firestore
 * Ejecuta esto en la consola del navegador: window.diagnosticoFirestore()
 */

import { db } from './firebase-client'
import { doc, getDoc, enableNetwork } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

export const diagnosticoFirestore = async () => {
  console.log('🔍 Iniciando diagnóstico de Firestore...\n')

  const resultados: any = {
    configuracion: {},
    conexion: {},
    autenticacion: {},
    documento: {},
    recomendaciones: [],
  }

  // 1. Verificar configuración
  console.log('1️⃣ Verificando configuración...')
  resultados.configuracion = {
    projectId: db.app.options.projectId,
    apiKey: db.app.options.apiKey ? `${db.app.options.apiKey.substring(0, 10)}...` : 'NO CONFIGURADO',
    authDomain: db.app.options.authDomain,
    tieneConfig: !!db.app.options.projectId && db.app.options.projectId !== 'dummy-project',
  }

  if (!resultados.configuracion.tieneConfig) {
    resultados.recomendaciones.push('❌ Firebase no está configurado correctamente. Verifica las variables de entorno.')
  } else {
    console.log('✅ Configuración OK:', resultados.configuracion)
  }

  // 2. Verificar conexión
  console.log('\n2️⃣ Verificando conexión...')
  try {
    await enableNetwork(db)
    resultados.conexion = {
      estado: 'online',
      mensaje: 'Conexión online habilitada',
    }
    console.log('✅ Conexión OK')
  } catch (error: any) {
    resultados.conexion = {
      estado: 'error',
      mensaje: error.message,
      code: error.code,
    }
    resultados.recomendaciones.push('❌ No se pudo habilitar conexión online. Verifica tu conexión a internet.')
    console.error('❌ Error de conexión:', error)
  }

  // 3. Verificar autenticación
  console.log('\n3️⃣ Verificando autenticación...')
  const auth = getAuth()
  const user = auth.currentUser

  if (user) {
    resultados.autenticacion = {
      autenticado: true,
      uid: user.uid,
      email: user.email,
    }
    console.log('✅ Usuario autenticado:', user.email)

    // 4. Intentar leer documento
    console.log('\n4️⃣ Intentando leer documento de usuario...')
    try {
      const userDocRef = doc(db, 'users', user.uid)
      console.log('📄 Ruta del documento:', userDocRef.path)

      const startTime = Date.now()
      const userDoc = await getDoc(userDocRef)
      const elapsedTime = Date.now() - startTime

      if (userDoc.exists()) {
        resultados.documento = {
          existe: true,
          datos: userDoc.data(),
          tiempoLectura: `${elapsedTime}ms`,
        }
        console.log('✅ Documento encontrado en', elapsedTime, 'ms')
        console.log('📋 Datos:', userDoc.data())
      } else {
        resultados.documento = {
          existe: false,
          mensaje: 'El documento no existe en Firestore',
        }
        resultados.recomendaciones.push(
          `❌ El documento usuarios/${user.uid} no existe. Créalo en Firebase Console.`
        )
        console.error('❌ Documento no existe')
      }
    } catch (error: any) {
      resultados.documento = {
        existe: false,
        error: error.message,
        code: error.code,
      }

      if (error.code === 'permission-denied') {
        resultados.recomendaciones.push(
          '❌ PERMISO DENEGADO: Las reglas de Firestore están bloqueando. Ve a Firebase Console → Firestore → Reglas y verifica que permitan lectura para usuarios autenticados.'
        )
      } else if (error.code === 'unavailable') {
        resultados.recomendaciones.push(
          '❌ Firestore no está disponible. Verifica: 1) Tu conexión a internet, 2) Que Firestore esté habilitado en Firebase Console.'
        )
      } else {
        resultados.recomendaciones.push(`❌ Error al leer documento: ${error.message}`)
      }

      console.error('❌ Error al leer documento:', error)
    }
  } else {
    resultados.autenticacion = {
      autenticado: false,
      mensaje: 'No hay usuario autenticado',
    }
    resultados.recomendaciones.push('⚠️ No hay usuario autenticado. Inicia sesión primero.')
    console.warn('⚠️ No hay usuario autenticado')
  }

  // Resumen
  console.log('\n📊 RESUMEN DEL DIAGNÓSTICO:')
  console.log('========================')
  console.log(JSON.stringify(resultados, null, 2))

  if (resultados.recomendaciones.length > 0) {
    console.log('\n💡 RECOMENDACIONES:')
    resultados.recomendaciones.forEach((rec: string) => console.log(rec))
  } else {
    console.log('\n✅ Todo parece estar correcto!')
  }

  return resultados
}

// Hacer disponible globalmente para ejecutar desde la consola
if (typeof window !== 'undefined') {
  ; (window as any).diagnosticoFirestore = diagnosticoFirestore
}
