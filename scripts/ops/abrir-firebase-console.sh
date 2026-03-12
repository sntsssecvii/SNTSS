#!/bin/bash

# Script para abrir Firebase Console en las secciones relevantes

PROJECT_ID="sntss-e2117"

echo "🚀 Abriendo Firebase Console..."
echo ""

# Detectar el comando para abrir el navegador según el sistema operativo
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    OPEN_CMD="open"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    OPEN_CMD="xdg-open"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    OPEN_CMD="start"
else
    echo "❌ Sistema operativo no soportado"
    exit 1
fi

echo "1️⃣  Abriendo Firestore (para crear base de datos)..."
$OPEN_CMD "https://console.firebase.google.com/project/$PROJECT_ID/firestore" 2>/dev/null || true
sleep 2

echo "2️⃣  Abriendo Reglas de Firestore (para después de crear la BD)..."
$OPEN_CMD "https://console.firebase.google.com/project/$PROJECT_ID/firestore/rules" 2>/dev/null || true
sleep 2

echo "3️⃣  Abriendo Authentication (para verificar usuarios)..."
$OPEN_CMD "https://console.firebase.google.com/project/$PROJECT_ID/authentication/users" 2>/dev/null || true
sleep 1

echo ""
echo "✅ Firebase Console abierto en tu navegador"
echo ""
echo "📋 Siguiente paso:"
echo "   1. En la pestaña de Firestore, haz clic en 'Crear base de datos'"
echo "   2. Selecciona 'Modo de prueba'"
echo "   3. Ubicación: us-central1"
echo "   4. Haz clic en 'Habilitar'"
echo ""
echo "   Luego ejecuta: node scripts/ops/crear-usuario-firestore.js"
echo ""
