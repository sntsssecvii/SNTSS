# Guía para Desplegar en Vercel

Esta guía te ayudará a subir tu proyecto SNTSS a Vercel paso a paso.

## Prerrequisitos

1. Cuenta en Vercel (gratis): https://vercel.com/signup
2. Cuenta en GitHub (gratis): https://github.com/signup
3. Node.js instalado en tu computadora

## Paso 1: Preparar el Repositorio Git

Abre tu terminal y ejecuta estos comandos en la carpeta del proyecto:

```bash
cd /Users/gerardoarroyo/Desktop/SNTSS

# Inicializar Git (si no lo has hecho)
git init

# Agregar todos los archivos
git add .

# Hacer el primer commit
git commit -m "Initial commit - Proyecto SNTSS"
```

## Paso 2: Subir a GitHub

1. Ve a https://github.com y crea un nuevo repositorio:
   - Click en "New repository"
   - Nombre: `sntss` (o el que prefieras)
   - Deja todo en público (puedes cambiarlo después)
   - NO marques "Initialize with README"
   - Click en "Create repository"

2. En tu terminal, ejecuta:

```bash
# Agregar el repositorio remoto (reemplaza TU_USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/sntss.git

# Cambiar a la rama main
git branch -M main

# Subir el código
git push -u origin main
```

## Paso 3: Conectar con Vercel

### Opción A: Desde la Web (Más Fácil)

1. Ve a https://vercel.com y haz login
2. Click en "Add New..." → "Project"
3. Importa tu repositorio de GitHub:
   - Selecciona el repositorio `sntss`
   - Click en "Import"

4. Configuración del proyecto:
   - **Framework Preset**: Next.js (debería detectarse automáticamente)
   - **Root Directory**: `./` (dejar por defecto)
   - **Build Command**: `npm run build` (ya está configurado)
   - **Output Directory**: `.next` (por defecto)
   - **Install Command**: `npm install` (por defecto)

5. **Variables de Entorno**: 
   Como tu proyecto tiene Firebase configurado directamente en el código, no necesitas agregar variables de entorno por ahora. Si más adelante quieres usar variables de entorno, agrega:
   
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAoGMgaouxlJgO6ZtDcN5xENh4jA6DZv90
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sntss-e2117.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=sntss-e2117
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sntss-e2117.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=32134453088
   NEXT_PUBLIC_FIREBASE_APP_ID=1:32134453088:web:edf0fbd37d146dcd6db005
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-VDMDF9RKZ3
   ```

6. Click en "Deploy"

### Opción B: Desde la Terminal (CLI)

1. Instala Vercel CLI:
```bash
npm i -g vercel
```

2. Login en Vercel:
```bash
vercel login
```

3. Desde la carpeta del proyecto:
```bash
cd /Users/gerardoarroyo/Desktop/SNTSS
vercel
```

4. Sigue las instrucciones:
   - ¿Set up and deploy? → **Y**
   - ¿Which scope? → Selecciona tu cuenta
   - ¿Link to existing project? → **N**
   - ¿What's your project's name? → `sntss` (o el que prefieras)
   - ¿In which directory is your code located? → `./`
   - ¿Want to override the settings? → **N**

5. Para producción:
```bash
vercel --prod
```

## Paso 4: Verificar el Deploy

1. Una vez completado el deploy, Vercel te dará una URL como:
   `https://sntss-xxxxx.vercel.app`

2. Abre esa URL en tu navegador y verifica que todo funcione

3. Cada vez que hagas `git push` a GitHub, Vercel desplegará automáticamente los cambios

## Configuración Adicional

### Dominio Personalizado (Opcional)

1. En el dashboard de Vercel, ve a tu proyecto
2. Settings → Domains
3. Agrega tu dominio personalizado

### Variables de Entorno (Recomendado para Producción)

Para mayor seguridad, es recomendable mover las credenciales de Firebase a variables de entorno:

1. En Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Agrega cada variable con su valor
3. Actualiza `src/lib/firebase/config.ts` para usar `process.env.NEXT_PUBLIC_*`

## Solución de Problemas

### Error de Build

Si el build falla:
1. Revisa los logs en Vercel Dashboard
2. Prueba hacer build localmente: `npm run build`
3. Verifica que todas las dependencias estén en `package.json`

### Firebase no funciona

1. Verifica que las credenciales de Firebase sean correctas
2. Asegúrate de que Firebase permita tu dominio de Vercel:
   - Ve a Firebase Console → Authentication → Settings → Authorized domains
   - Agrega tu dominio de Vercel

### Errores de CORS

Si hay errores de CORS:
1. Verifica las reglas de Firestore en Firebase Console
2. Asegúrate de que tu dominio esté autorizado

## Comandos Útiles

```bash
# Ver logs de deploy
vercel logs

# Ver información del proyecto
vercel inspect

# Listar proyectos
vercel list

# Abrir dashboard en navegador
vercel dashboard
```

## Soporte

- Documentación de Vercel: https://vercel.com/docs
- Documentación de Next.js: https://nextjs.org/docs
- Firebase Console: https://console.firebase.google.com

¡Éxito con tu deploy! 🚀
