#!/bin/bash

# Script de diagnóstico completo para SNTSS
# Verifica Firebase Auth, Firestore y la configuración

echo "🔍 DIAGNÓSTICO COMPLETO - SNTSS"
echo "================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
PROJECT_ID="sntss-e2117"
USER_EMAIL="gerardoyx@hotmail.com"
USER_PASSWORD="123456"
API_KEY="AIzaSyAoGMgaouxlJgO6ZtDcN5xENh4jA6DZv90"

echo "📋 Configuración:"
echo "   Proyecto: $PROJECT_ID"
echo "   Usuario: $USER_EMAIL"
echo ""

# 1. Verificar archivo .env.local
echo "1️⃣  Verificando archivo .env.local..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}   ✅ Archivo .env.local existe${NC}"
    
    # Verificar que contenga las variables necesarias
    if grep -q "NEXT_PUBLIC_FIREBASE_API_KEY" .env.local; then
        echo -e "${GREEN}   ✅ NEXT_PUBLIC_FIREBASE_API_KEY configurado${NC}"
    else
        echo -e "${RED}   ❌ NEXT_PUBLIC_FIREBASE_API_KEY no encontrado${NC}"
    fi
else
    echo -e "${RED}   ❌ Archivo .env.local NO existe${NC}"
    echo -e "${YELLOW}   ⚠️  Crea el archivo .env.local con las credenciales de Firebase${NC}"
fi
echo ""

# 2. Probar autenticación
echo "2️⃣  Probando Firebase Authentication..."
AUTH_RESPONSE=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\",\"returnSecureToken\":true}")

if echo "$AUTH_RESPONSE" | grep -q "idToken"; then
    echo -e "${GREEN}   ✅ Autenticación exitosa${NC}"
    
    # Extraer UID y token
    USER_UID=$(echo "$AUTH_RESPONSE" | grep -o '"localId":"[^"]*"' | cut -d'"' -f4)
    ID_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"idToken":"[^"]*"' | cut -d'"' -f4)
    
    echo "   UID: $USER_UID"
else
    echo -e "${RED}   ❌ Error en autenticación${NC}"
    echo "   Respuesta: $AUTH_RESPONSE"
    echo ""
    echo -e "${YELLOW}   Verifica que el usuario exista en Firebase Console${NC}"
    echo "   URL: https://console.firebase.google.com/project/$PROJECT_ID/authentication/users"
    exit 1
fi
echo ""

# 3. Probar Firestore
echo "3️⃣  Probando Firestore..."
FIRESTORE_RESPONSE=$(curl -s -X GET "https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default)/documents/usuarios/$USER_UID" \
  -H "Authorization: Bearer $ID_TOKEN")

if echo "$FIRESTORE_RESPONSE" | grep -q '"name"'; then
    echo -e "${GREEN}   ✅ Firestore habilitado y documento existe${NC}"
    echo "   Documento: usuarios/$USER_UID"
    
    # Extraer rol
    if echo "$FIRESTORE_RESPONSE" | grep -q '"rol"'; then
        ROL=$(echo "$FIRESTORE_RESPONSE" | grep -A1 '"rol"' | grep 'stringValue' | cut -d'"' -f4)
        echo "   Rol: $ROL"
    fi
elif echo "$FIRESTORE_RESPONSE" | grep -q "NOT_FOUND"; then
    if echo "$FIRESTORE_RESPONSE" | grep -q "database"; then
        echo -e "${RED}   ❌ FIRESTORE NO ESTÁ HABILITADO${NC}"
        echo ""
        echo -e "${YELLOW}   Para solucionar:${NC}"
        echo "   1. Ve a: https://console.firebase.google.com/project/$PROJECT_ID/firestore"
        echo "   2. Haz clic en 'Crear base de datos'"
        echo "   3. Selecciona 'Modo de prueba'"
        echo "   4. Selecciona ubicación: us-central1"
        echo "   5. Haz clic en 'Habilitar'"
        echo ""
        echo -e "${BLUE}   Luego ejecuta:${NC}"
        echo "   node scripts/ops/crear-usuario-firestore.js"
        exit 1
    else
        echo -e "${YELLOW}   ⚠️  Firestore habilitado pero documento no existe${NC}"
        echo "   Documento faltante: usuarios/$USER_UID"
        echo ""
        echo -e "${BLUE}   Para crear el documento:${NC}"
        echo "   node scripts/ops/crear-usuario-firestore.js"
        exit 1
    fi
elif echo "$FIRESTORE_RESPONSE" | grep -q "PERMISSION_DENIED"; then
    echo -e "${RED}   ❌ ERROR DE PERMISOS${NC}"
    echo "   Las reglas de Firestore están bloqueando el acceso"
    echo ""
    echo -e "${YELLOW}   Para solucionar:${NC}"
    echo "   1. Ve a: https://console.firebase.google.com/project/$PROJECT_ID/firestore/rules"
    echo "   2. Copia las reglas del archivo firestore.rules"
    echo "   3. Haz clic en 'Publicar'"
    exit 1
else
    echo -e "${RED}   ❌ Error desconocido${NC}"
    echo "   Respuesta: $FIRESTORE_RESPONSE"
    exit 1
fi
echo ""

# 4. Verificar dependencias
echo "4️⃣  Verificando dependencias de Node.js..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}   ✅ node_modules existe${NC}"
else
    echo -e "${YELLOW}   ⚠️  node_modules no encontrado${NC}"
    echo "   Ejecuta: npm install"
fi
echo ""

# 5. Verificar proceso de desarrollo
echo "5️⃣  Verificando servidor de desarrollo..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}   ✅ Servidor corriendo en puerto 3000${NC}"
else
    echo -e "${YELLOW}   ⚠️  Servidor no está corriendo${NC}"
    echo "   Ejecuta: npm run dev"
fi
echo ""

# Resumen final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ DIAGNÓSTICO COMPLETADO ✨${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Si todo está verde, el inicio de sesión debería funcionar."
echo ""
echo "Para probar:"
echo "1. Abre http://localhost:3000"
echo "2. Inicia sesión con:"
echo "   Email: $USER_EMAIL"
echo "   Contraseña: [tu contraseña]"
echo ""
