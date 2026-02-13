# Checklist de Verificación de Firestore

## ✅ Verificaciones en Firebase Console

### 1. Verificar que Firestore esté habilitado

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto: **sntss-e2117**
3. En el menú lateral izquierdo, busca **"Firestore Database"**
4. Si aparece en el menú y puedes hacer clic, está habilitado ✅
5. Si no aparece, necesitas habilitarlo:
   - Haz clic en "Firestore Database"
   - Haz clic en "Crear base de datos"
   - Selecciona "Modo de prueba" (para desarrollo)
   - Elige la ubicación (us-east1, us-central1, etc.)

### 2. Verificar el Modo de Firestore

1. En Firestore Database, ve a la pestaña **"Datos"**
2. En la parte superior, verifica si dice:
   - **"Modo de prueba"** - ✅ Correcto para desarrollo
   - **"Modo de producción"** - ⚠️ Necesitas configurar reglas

### 3. Verificar las Reglas de Seguridad (CRÍTICO)

1. En Firestore Database, ve a la pestaña **"Reglas"**
2. Las reglas deben verse así:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Reglas para usuarios
    match /usuarios/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Para desarrollo
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para propuestas
    match /propuestas/{propuestaId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. **IMPORTANTE**: Haz clic en **"Publicar"** después de editar las reglas
4. Verifica que no haya errores de sintaxis (aparecerán en rojo)

### 4. Probar las Reglas con el Simulador

1. En la pestaña **"Reglas"**, haz clic en **"Simulador"** (arriba a la derecha)
2. Configura:
   - **Tipo**: "Leer"
   - **Ubicación**: `usuarios/AqwcyeZtxEekx1MUoEToTo9ZJ1E2`
   - **Autenticado**: Sí
   - **UID**: `AqwcyeZtxEekx1MUoEToTo9ZJ1E2`
3. Haz clic en **"Ejecutar"**
4. Debe mostrar: **"Permitido"** ✅
5. Si muestra "Denegado", las reglas están bloqueando

### 5. Verificar que el Documento Existe

1. En la pestaña **"Datos"**
2. Verifica que existe la colección **"usuarios"**
3. Verifica que existe el documento con ID: **AqwcyeZtxEekx1MUoEToTo9ZJ1E2**
4. Verifica que tiene estos campos:
   - `email`: "gerardoyx@hotmail.com"
   - `nombre`: "Gerardo"
   - `apellidoPaterno`: "Arroyo"
   - `apellidoMaterno`: "Arguelles"
   - `rol`: "ADMIN"

### 6. Verificar Variables de Entorno

En tu archivo `.env.local` (en la raíz del proyecto), verifica que tengas:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sntss-e2117.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sntss-e2117
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sntss-e2117.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

## 🔍 Diagnóstico Rápido

Si después de verificar todo lo anterior sigue sin funcionar:

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Network" (Red)
3. Filtra por "firestore"
4. Intenta iniciar sesión
5. Revisa si hay peticiones a Firestore y qué código de respuesta tienen

## 🚨 Problemas Comunes

### Problema: "Permission Denied"
**Solución**: Las reglas de Firestore están bloqueando. Verifica el paso 3.

### Problema: "Document not found"
**Solución**: El documento no existe o el UID no coincide. Verifica el paso 5.

### Problema: "Timeout"
**Solución**: 
- Verifica tu conexión a internet
- Verifica que Firestore esté habilitado (paso 1)
- Verifica las reglas (paso 3)
- Intenta desde otra red (a veces hay problemas de firewall)
