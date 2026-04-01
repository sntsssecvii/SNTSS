#!/bin/bash

# Script maestro para solucionar el problema de inicio de sesión

clear

echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║     🔧 SOLUCIÓN DE INICIO DE SESIÓN - SNTSS 🔧       ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Función para esperar entrada del usuario
wait_for_user() {
    echo -e "${CYAN}Presiona ENTER cuando hayas completado este paso...${NC}"
    read
}

# Función para ejecutar un comando y verificar el resultado
run_command() {
    echo -e "${BLUE}Ejecutando: $1${NC}"
    eval "$1"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Comando exitoso${NC}"
        return 0
    else
        echo -e "${RED}❌ Error en el comando${NC}"
        return 1
    fi
}

echo "Este script te guiará paso a paso para solucionar el problema."
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "   El problema es que Firestore NO está habilitado en tu proyecto."
echo "   Necesitarás acceso a Firebase Console para solucionarlo."
echo ""
wait_for_user

# PASO 1: Diagnóstico inicial
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${MAGENTA}📊 PASO 1: Diagnóstico Inicial${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_command "./scripts/ops/diagnostico-completo.sh"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ¡Todo está funcionando correctamente!${NC}"
    echo ""
    echo "Puedes iniciar sesión en http://localhost:3000"
    exit 0
fi

echo ""
echo -e "${YELLOW}Como era de esperar, Firestore no está habilitado.${NC}"
echo "Continuemos con la solución..."
wait_for_user

# PASO 2: Abrir Firebase Console
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${MAGENTA}🌐 PASO 2: Habilitar Firestore${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Voy a abrir Firebase Console en tu navegador..."
echo ""
run_command "./scripts/ops/abrir-firebase-console.sh"

echo ""
echo -e "${YELLOW}📋 INSTRUCCIONES:${NC}"
echo ""
echo "   En la pestaña de Firestore que se abrió:"
echo ""
echo "   1️⃣  Haz clic en el botón ${GREEN}'Crear base de datos'${NC}"
echo "   2️⃣  Selecciona ${GREEN}'Modo de prueba'${NC} (para desarrollo)"
echo "   3️⃣  Ubicación: ${GREEN}'us-central1'${NC} (o la más cercana)"
echo "   4️⃣  Haz clic en ${GREEN}'Habilitar'${NC}"
echo "   5️⃣  Espera a que se cree (puede tardar 1-2 minutos)"
echo ""
echo -e "${CYAN}⏳ Cuando veas la interfaz de Firestore lista...${NC}"
wait_for_user

# PASO 3: Crear documento de usuario
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${MAGENTA}👤 PASO 3: Crear Documento de Usuario${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Ahora voy a crear el documento del usuario en Firestore..."
echo ""

run_command "node scripts/ops/crear-usuario-firestore.js"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Documento de usuario creado correctamente${NC}"
else
    echo ""
    echo -e "${RED}❌ Error al crear el documento${NC}"
    echo ""
    echo -e "${YELLOW}Posibles causas:${NC}"
    echo "   - Firestore aún no terminó de crearse (espera 1 minuto y reintenta)"
    echo "   - Las reglas de seguridad están bloqueando la escritura"
    echo ""
    echo "Puedes:"
    echo "   a) Esperar un minuto y ejecutar: node scripts/ops/crear-usuario-firestore.js"
    echo "   b) Crear el documento manualmente en Firebase Console"
    echo ""
    wait_for_user
fi

# PASO 4: Configurar reglas
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${MAGENTA}🔒 PASO 4: Configurar Reglas de Seguridad${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Las reglas de seguridad ya están en el archivo: firestore.rules"
echo ""
echo -e "${YELLOW}📋 Para aplicarlas:${NC}"
echo ""
echo "   OPCIÓN 1 - Firebase CLI (recomendado):"
echo "   $ firebase deploy --only firestore:rules"
echo ""
echo "   OPCIÓN 2 - Firebase Console:"
echo "   1. Ve a la pestaña 'Reglas' que se abrió"
echo "   2. Copia el contenido del archivo firestore.rules"
echo "   3. Pégalo en el editor"
echo "   4. Haz clic en 'Publicar'"
echo ""

echo -e "${CYAN}¿Quieres que intente aplicar las reglas con Firebase CLI? (s/n)${NC}"
read -r APLICAR_REGLAS

if [[ "$APLICAR_REGLAS" =~ ^[Ss]$ ]]; then
    run_command "firebase deploy --only firestore:rules"
else
    echo ""
    echo -e "${YELLOW}Aplica las reglas manualmente en Firebase Console${NC}"
    wait_for_user
fi

# PASO 5: Diagnóstico final
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${MAGENTA}🔍 PASO 5: Verificación Final${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Ejecutando diagnóstico final..."
echo ""

run_command "./scripts/ops/diagnostico-completo.sh"

if [ $? -eq 0 ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║                                                       ║"
    echo "║           🎉 ¡SOLUCIÓN COMPLETADA! 🎉                ║"
    echo "║                                                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${GREEN}✅ Todo está configurado correctamente${NC}"
    echo ""
    echo "📋 Siguiente paso:"
    echo ""
    echo "   1. Inicia el servidor de desarrollo:"
    echo "      $ npm run dev"
    echo ""
    echo "   2. Abre tu navegador en:"
    echo "      http://localhost:3000"
    echo ""
    echo "   3. Inicia sesión con:"
    echo "      Email: gerardoyx@hotmail.com"
    echo "      Contraseña: 123456"
    echo ""
    echo -e "${CYAN}¿Quieres que inicie el servidor ahora? (s/n)${NC}"
    read -r INICIAR_SERVIDOR
    
    if [[ "$INICIAR_SERVIDOR" =~ ^[Ss]$ ]]; then
        echo ""
        echo "Iniciando servidor de desarrollo..."
        npm run dev
    fi
else
    echo ""
    echo -e "${RED}❌ Aún hay problemas${NC}"
    echo ""
    echo "Revisa los mensajes de error arriba y:"
    echo "   - Verifica que Firestore esté habilitado"
    echo "   - Verifica que el documento de usuario exista"
    echo "   - Verifica que las reglas permitan lectura/escritura"
    echo ""
    echo "Para más ayuda, revisa:"
    echo "   - README-SOLUCION.md (resumen ejecutivo)"
    echo "   - SOLUCION-FIRESTORE.md (guía detallada)"
fi
