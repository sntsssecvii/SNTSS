# 🚀 Guía Rápida: Desplegar SNTSS en Vercel

## Opción 1: Método Más Rápido (Recomendado) ⚡

### Paso 1: Subir a GitHub

1. **Crea cuenta en GitHub** (si no tienes): https://github.com/signup

2. **Crea un nuevo repositorio**:
   - Ve a https://github.com/new
   - Nombre: `sntss`
   - Público o Privado (tu elección)
   - **NO** marques "Initialize with README"
   - Click "Create repository"

3. **En tu terminal, ejecuta**:

```bash
cd /Users/gerardoarroyo/Desktop/SNTSS

# Inicializar Git
git init
git add .
git commit -m "Initial commit"

# Conectar con GitHub (reemplaza TU_USUARIO)
git remote add origin https://github.com/TU_USUARIO/sntss.git
git branch -M main
git push -u origin main
```

### Paso 2: Desplegar en Vercel

1. **Ve a Vercel**: https://vercel.com/login
   - Si no tienes cuenta, créala con GitHub (es gratis)

2. **Importa tu proyecto**:
   - Click "Add New..." → "Project"
   - Selecciona el repositorio `sntss`
   - Click "Import"

3. **Configuración** (deja todo por defecto):
   - Framework: Next.js ✅
   - Build Command: `npm run build` ✅
   - Output Directory: `.next` ✅

4. **Click "Deploy"** 🎉

5. **¡Listo!** En 2-3 minutos tendrás tu app en línea

---

## Opción 2: Usar Vercel CLI (Terminal)

### Instalar Vercel CLI

```bash
npm install -g vercel
```

### Desplegar

```bash
cd /Users/gerardoarroyo/Desktop/SNTSS

# Login en Vercel
vercel login

# Desplegar (primera vez)
vercel

# Desplegar a producción
vercel --prod
```

---

## Opción 3: Usar el Script Automático

```bash
cd /Users/gerardoarroyo/Desktop/SNTSS
bash deploy.sh
```

El script te guiará paso a paso.

---

## ✅ Después del Deploy

1. **Obtendrás una URL** como: `https://sntss-xxxxx.vercel.app`
2. **Cada vez que hagas `git push`**, Vercel desplegará automáticamente
3. **Puedes agregar un dominio personalizado** en Settings → Domains

---

## 🔧 Configuración de Firebase (Opcional)

Tu proyecto ya tiene Firebase configurado. Si quieres usar variables de entorno (más seguro):

1. En Vercel Dashboard → Settings → Environment Variables
2. Agrega estas variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAoGMgaouxlJgO6ZtDcN5xENh4jA6DZv90
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sntss-e2117.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sntss-e2117
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sntss-e2117.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=32134453088
NEXT_PUBLIC_FIREBASE_APP_ID=1:32134453088:web:edf0fbd37d146dcd6db005
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-VDMDF9RKZ3
```

---

## 🆘 Problemas Comunes

### Error: "Build failed"
- Ejecuta `npm run build` localmente para ver el error
- Verifica que todas las dependencias estén instaladas

### Firebase no funciona
- Ve a Firebase Console → Authentication → Settings
- Agrega tu dominio de Vercel a "Authorized domains"

### No se conecta a Firestore
- Verifica las reglas de Firestore en Firebase Console
- Asegúrate de que tu dominio esté autorizado

---

## 📚 Recursos

- [Documentación Vercel](https://vercel.com/docs)
- [Documentación Next.js](https://nextjs.org/docs)
- [Firebase Console](https://console.firebase.google.com)

---

**¿Necesitas ayuda?** Revisa el archivo `DEPLOY-VERCEL.md` para instrucciones detalladas.
