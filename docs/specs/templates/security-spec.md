# Security Spec

## Objetivo

Describe que superficie se va a endurecer y por que.

## Superficie afectada

- rutas API
- Firestore rules
- Storage rules
- auth
- variables de entorno

## Riesgo actual

- que puede salir mal hoy
- que tan explotable es
- impacto operativo o de privacidad

## Reglas de seguridad esperadas

- quien puede leer
- quien puede escribir
- quien puede administrar
- que datos nunca deben exponerse

## Cambios propuestos

- cambio 1
- cambio 2
- cambio 3

## Riesgos del cambio

- posible regresion
- impacto en usuarios/admin
- estrategia de rollback si aplica

## Criterios de aceptacion

- la ruta exige token valido
- el rol se valida correctamente
- Firestore deja de permitir accesos amplios
- la experiencia sigue funcionando para usuarios validos

## Validacion

- typecheck / lint
- prueba manual como admin
- prueba manual como user
- prueba negativa sin permisos

## Pendientes

- decisiones abiertas
- reglas por confirmar con negocio
