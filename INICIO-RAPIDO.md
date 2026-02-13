# ⚡ Inicio Rápido - Solución de Login

## 🚨 Problema
El inicio de sesión **se queda cargando indefinidamente**.

## ✅ Causa
**Firestore NO está habilitado** en el proyecto Firebase.

## 🎯 Solución Rápida (5 minutos)

### Opción 1: Script Automático (Recomendado) 🤖

```bash
./scripts/solucionar-login.sh
```

Este script te guiará paso a paso por todo el proceso.

---

### Opción 2: Manual ✋

#### Paso 1: Habilitar Firestore
```bash
# Abre Firebase Console
./scripts/abrir-firebase-console.sh

# O ve directamente a:
# https://console.firebase.google.com/project/sntss-e2117/firestore
```

- Haz clic en **"Crear base de datos"**
- Modo: **Prueba**
- Ubicación: **us-central1**
- Clic en **"Habilitar"**

#### Paso 2: Crear Usuario
```bash
node scripts/crear-usuario-firestore.js
```

#### Paso 3: Aplicar Reglas
```bash
firebase deploy --only firestore:rules
```

#### Paso 4: Verificar
```bash
./scripts/diagnostico-completo.sh
```

---

## 📁 Archivos de Ayuda

| Archivo | Descripción |
|---------|-------------|
| `README-SOLUCION.md` | 📖 Resumen ejecutivo completo |
| `SOLUCION-FIRESTORE.md` | 📚 Guía detallada paso a paso |
| `scripts/solucionar-login.sh` | 🤖 Script interactivo guiado |
| `scripts/diagnostico-completo.sh` | 🔍 Verificar estado actual |
| `scripts/crear-usuario-firestore.js` | 👤 Crear documento de usuario |
| `firestore.rules` | 🔒 Reglas de seguridad |

---

## 🧪 Probar la Solución

```bash
# 1. Iniciar servidor
npm run dev

# 2. Abrir navegador
open http://localhost:3000

# 3. Iniciar sesión
Email: gerardoyx@hotmail.com
Contraseña: 123456
```

---

## ❓ ¿Problemas?

```bash
# Ejecuta el diagnóstico
./scripts/diagnostico-completo.sh

# Te dirá exactamente qué falta
```

---

## 📊 Estado Actual

Ejecuta esto para ver el estado:

```bash
./scripts/diagnostico-completo.sh
```

Deberías ver:
- ✅ Autenticación funcionando
- ❌ Firestore no habilitado ← **Este es el problema**

Después de la solución:
- ✅ Autenticación funcionando
- ✅ Firestore habilitado
- ✅ Documento de usuario creado
- ✅ Reglas configuradas

---

## 🎉 Resultado

Después de seguir los pasos:
- ⚡ Inicio de sesión instantáneo (< 2 segundos)
- ✅ Sin errores
- ✅ Redirección automática al dashboard

---

**Tiempo total: ~5-10 minutos**

¡Empieza ahora! 👉 `./scripts/solucionar-login.sh`
