# Agent And MCP Policy

## Objetivo

Usar agentes y MCPs para acelerar trabajo repetible sin perder control operativo.

## Regla base

Un agente no debe adivinar acceso, permisos o impacto sobre sistemas externos. Si una tarea toca datos reales, credenciales o infraestructura, el acceso debe ser explicito y acotado.

## MCPs recomendados

- GitHub MCP
  - uso: PRs, issues, revisiones, ramas, estado de repositorio remoto
  - no usar para operaciones masivas sin revisar alcance
- Filesystem MCP
  - uso: leer y editar el repo con rutas claras
  - preferir cambios pequenos y verificables
- Firestore/Firebase MCP
  - uso: inspeccion controlada de colecciones, documentos o metadatos
  - no usar para escrituras en produccion sin confirmacion expresa
- Docs/Notes MCP
  - uso: specs, ADRs, backlog tecnico, decisiones de negocio

## Lo que requiere confirmacion humana

- cambios de reglas Firebase
- escrituras en Firestore real
- despliegues
- eliminaciones masivas
- cambio de proveedor externo
- operaciones que mezclen datos reales y scripts de mantenimiento

## Modo recomendado de trabajo

1. Definir la tarea con un alcance claro.
2. Elegir el skill adecuado.
3. Usar el MCP minimo necesario.
4. Validar con pruebas o checks antes de cerrar.
5. Dejar resumen con impacto y riesgo.

## Politica de seguridad

- no secretos en commits
- no tokens en remotes Git
- no accesos amplios por comodidad
- no tocar produccion si la tarea puede resolverse con lectura o pruebas locales
