'use client'

import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase/firebase-client'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, enableNetwork } from 'firebase/firestore'

export default function TestFirestorePage() {
  const [log, setLog] = useState<string[]>([])
  const [testing, setTesting] = useState(false)

  const addLog = (message: string) => {
    console.log(message)
    setLog(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0, 12)} - ${message}`])
  }

  const testFirestore = async () => {
    setTesting(true)
    setLog([])

    try {
      addLog('🔍 Iniciando prueba de Firestore...')
      addLog('')

      // Paso 1: Verificar configuración
      addLog('1️⃣  Verificando configuración de Firebase')
      addLog(`   Project ID: ${db.app.options.projectId}`)
      addLog(`   Auth Domain: ${db.app.options.authDomain}`)
      addLog(`   API Key: ${(db.app.options.apiKey as string)?.substring(0, 10)}...`)
      addLog('   ✅ Configuración OK')
      addLog('')

      // Paso 2: Autenticar
      addLog('2️⃣  Autenticando usuario...')
      const email = 'gerardoyx@hotmail.com'
      const password = '123456'

      const startAuth = Date.now()
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const authTime = Date.now() - startAuth

      addLog(`   ✅ Autenticado: ${userCredential.user.email}`)
      addLog(`   UID: ${userCredential.user.uid}`)
      addLog(`   Tiempo: ${authTime}ms`)
      addLog('')

      // Paso 3: Forzar conexión online
      addLog('3️⃣  Forzando conexión online de Firestore...')
      try {
        await enableNetwork(db)
        addLog('   ✅ Conexión online habilitada')
      } catch (error: any) {
        addLog(`   ⚠️  Error al habilitar red: ${error.message}`)
      }
      addLog('')

      // Paso 4: Leer documento
      addLog('4️⃣  Leyendo documento de Firestore...')
      addLog(`   Ruta: usuarios/${userCredential.user.uid}`)

      const startRead = Date.now()
      const userDocRef = doc(db, 'usuarios', userCredential.user.uid)

      addLog('   📡 Ejecutando getDoc()...')
      addLog('   ⏳ Esperando respuesta...')

      const userDoc = await Promise.race([
        getDoc(userDocRef),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT después de 8 segundos')), 8000)
        )
      ]) as any

      const readTime = Date.now() - startRead

      addLog(`   ⏱️  Tiempo de lectura: ${readTime}ms`)

      if (userDoc.exists()) {
        const data = userDoc.data()
        addLog('   ✅ ¡DOCUMENTO ENCONTRADO!')
        addLog('')
        addLog('   📋 Datos del documento:')
        addLog(`      - email: ${data.email}`)
        addLog(`      - nombre: ${data.nombre}`)
        addLog(`      - apellidoPaterno: ${data.apellidoPaterno}`)
        addLog(`      - apellidoMaterno: ${data.apellidoMaterno}`)
        addLog(`      - rol: ${data.rol}`)
        addLog('')
        addLog('✅ ¡TODO FUNCIONA CORRECTAMENTE!')
        addLog('')
        addLog('💡 Si el login normal sigue fallando, puede ser un problema de timing o estado.')

      } else {
        addLog('   ❌ El documento NO existe')
        addLog('')
        addLog('   Esto significa que:')
        addLog('   1. El documento no fue creado en Firestore')
        addLog('   2. O el UID no coincide')
        addLog('')
        addLog(`   Verifica en Firebase Console que exista: usuarios/${userCredential.user.uid}`)
      }

    } catch (error: any) {
      addLog('')
      addLog('❌ ERROR:')
      addLog(`   Mensaje: ${error.message}`)
      addLog(`   Código: ${error.code}`)

      if (error.stack) {
        addLog('')
        addLog('   Stack trace:')
        error.stack.split('\n').forEach((line: string) => {
          addLog(`   ${line}`)
        })
      }

      addLog('')

      if (error.code === 'permission-denied') {
        addLog('🔒 PROBLEMA DE PERMISOS')
        addLog('')
        addLog('   Las reglas de Firestore están bloqueando la lectura.')
        addLog('   Ve a: https://console.firebase.google.com/project/sntss-e2117/firestore/rules')
        addLog('   Y asegúrate de que permitan lectura para usuarios autenticados.')
      } else if (error.code === 'unavailable') {
        addLog('📡 PROBLEMA DE CONEXIÓN')
        addLog('')
        addLog('   Firestore no está disponible.')
        addLog('   1. Verifica tu conexión a internet')
        addLog('   2. Verifica que Firestore esté habilitado en Firebase Console')
      }

    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2">🔍 Diagnóstico de Firestore</h1>
          <p className="text-gray-600 mb-6">
            Esta página prueba la conexión a Firestore directamente desde el navegador
          </p>

          <button
            onClick={testFirestore}
            disabled={testing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg mb-6 transition-colors"
          >
            {testing ? '🔄 Probando...' : '▶️ Ejecutar Prueba'}
          </button>

          {log.length > 0 && (
            <div className="bg-gray-900 text-green-400 rounded-lg p-6 font-mono text-sm overflow-auto max-h-[600px]">
              {log.map((line, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))}
            </div>
          )}

          {!testing && log.length === 0 && (
            <div className="bg-gray-100 rounded-lg p-6 text-center text-gray-500">
              Haz clic en &quot;Ejecutar Prueba&quot; para comenzar el diagnóstico
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="font-bold text-blue-900 mb-2">ℹ️ Información</h2>
          <p className="text-blue-800 text-sm">
            Esta prueba intenta:
          </p>
          <ol className="list-decimal list-inside text-blue-800 text-sm mt-2 space-y-1">
            <li>Verificar la configuración de Firebase</li>
            <li>Autenticar con las credenciales de prueba</li>
            <li>Leer el documento del usuario desde Firestore</li>
          </ol>
          <p className="text-blue-800 text-sm mt-3">
            Si esta prueba funciona pero el login normal no, entonces el problema es específico del flujo de AuthContext.
          </p>
        </div>
      </div>
    </div>
  )
}
