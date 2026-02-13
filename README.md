# SNTSS

Sistema de gestión SNTSS con autenticación y redirección basado en roles.

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales de Firebase.

3. Ejecutar en desarrollo:
```bash
npm run dev
```

## Estructura del Proyecto

- `src/app/` - Páginas y layouts de Next.js
- `src/components/` - Componentes React reutilizables
- `src/contexts/` - Contextos de React (AuthContext)
- `src/lib/` - Utilidades y configuración de Firebase
- `src/types/` - Tipos TypeScript

## Autenticación

El sistema incluye:
- Login con Firebase Authentication
- Redirección automática basada en roles
- Protección de rutas
- Contexto de autenticación global

## Roles

Los roles actuales son:
- `ADMIN` - Redirige a `/admin`
- `USER` - Redirige a `/dashboard`

Puedes modificar los roles y rutas en:
- `src/types/roles.ts` - Definición de roles
- `src/components/LoginForm.tsx` - Mapeo de roles a rutas
