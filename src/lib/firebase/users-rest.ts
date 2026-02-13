/**
 * Alternativa usando API REST directa si el SDK falla
 */

import { getAuth } from 'firebase/auth'

export interface UserData {
  email: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  rol: string
  createdAt?: any
  updatedAt?: any
}

export const getCurrentUserDataREST = async (): Promise<UserData | null> => {
  const auth = getAuth()
  const user = auth.currentUser
  
  if (!user) {
    return null
  }
  
  try {
    // Obtener token de autenticación
    const idToken = await user.getIdToken()
    
    // Llamar a la API REST de Firestore
    const projectId = 'sntss-e2117'
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/usuarios/${user.uid}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Firestore REST API error: ${error.error?.message || response.statusText}`)
    }
    
    const data = await response.json()
    
    // Convertir campos de Firestore REST API a objeto normal
    const fields = data.fields || {}
    const userData: UserData = {
      email: fields.email?.stringValue || '',
      nombre: fields.nombre?.stringValue || '',
      apellidoPaterno: fields.apellidoPaterno?.stringValue || '',
      apellidoMaterno: fields.apellidoMaterno?.stringValue || '',
      rol: fields.rol?.stringValue || '',
      createdAt: fields.createdAt?.timestampValue,
      updatedAt: fields.updatedAt?.timestampValue
    }
    
    return userData
    
  } catch (error: any) {
    console.error('Error obteniendo datos del usuario vía REST:', error)
    throw error
  }
}
