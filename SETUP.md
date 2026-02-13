# Configuración del Proyecto SNTSS

## ✅ Estado Actual

El proyecto está **compilando correctamente** y listo para usar. Los errores de Firebase que aparecen son **esperados** hasta que configures las variables de entorno.

## 🔧 Pasos para Completar la Configuración

### 1. Crear archivo `.env.local`

En la raíz del proyecto, crea un archivo `.env.local` con tus credenciales de Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain_aqui
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id_aqui
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket_aqui
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id_aqui
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id_aqui
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=tu_measurement_id_aqui
```

### 2. Reiniciar el servidor

Después de crear el archivo `.env.local`, reinicia el servidor de desarrollo:

```bash
# Detén el servidor actual (Ctrl+C) y ejecuta:
npm run dev
```

## 📝 Notas

- Los errores de `FirebaseError: Firebase: Error (auth/invalid-api-key)` desaparecerán una vez que configures las variables de entorno.
- El proyecto está configurado para manejar la ausencia de configuración de Firebase sin romper la compilación.
- El servidor compila correctamente: `✓ Compiled in 2.8s (1470 modules)`

## 🚀 Estructura del Proyecto

- **Login y Autenticación**: Completamente funcional
- **Redirección por Roles**: Implementada (ADMIN → /admin, USER → /dashboard)
- **Componentes UI**: Todos los componentes necesarios están incluidos
- **Manejo de Errores**: Configurado para manejar Firebase no configurado

## ✨ Próximos Pasos

1. Configura las variables de entorno de Firebase
2. Crea usuarios en Firebase Authentication
3. Crea documentos de usuario en Firestore (colección `usuarios`)
4. Personaliza las páginas según tus necesidades
