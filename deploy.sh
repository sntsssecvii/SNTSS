#!/bin/bash

# Script para desplegar SNTSS a Vercel
# Ejecuta: bash deploy.sh

echo "🚀 Preparando despliegue a Vercel..."
echo ""

# Verificar si Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "📦 Vercel CLI no está instalado. Instalando..."
    npm install -g vercel
fi

# Verificar si estamos en un repositorio git
if [ ! -d ".git" ]; then
    echo "⚠️  No se encontró repositorio Git. Inicializando..."
    git init
    git add .
    git commit -m "Initial commit - Proyecto SNTSS"
    echo ""
    echo "📝 IMPORTANTE: Necesitas subir este código a GitHub primero."
    echo "   1. Crea un repositorio en GitHub: https://github.com/new"
    echo "   2. Ejecuta estos comandos:"
    echo "      git remote add origin https://github.com/TU_USUARIO/sntss.git"
    echo "      git branch -M main"
    echo "      git push -u origin main"
    echo ""
    read -p "¿Ya subiste el código a GitHub? (s/n): " respuesta
    if [ "$respuesta" != "s" ]; then
        echo "❌ Por favor sube el código a GitHub primero y luego ejecuta este script de nuevo."
        exit 1
    fi
fi

echo "🔐 Iniciando sesión en Vercel..."
vercel login

echo ""
echo "📤 Desplegando a Vercel..."
vercel --prod

echo ""
echo "✅ ¡Despliegue completado!"
echo ""
echo "💡 Para futuros despliegues, simplemente ejecuta: vercel --prod"
echo "   O haz push a GitHub y Vercel desplegará automáticamente."
