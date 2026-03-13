# Security Spec: Hardening inicial de SNTSS

## Objetivo

Endurecer la seguridad del sistema en las superficies con más riesgo real: rutas API administrativas, reglas de Firestore, configuración de Firebase y exposición indebida de datos del trabajador.

## Superficie afectada

- rutas API de bolsa de trabajo
- Firestore rules
- Storage rules
- autenticación y autorización
- configuración de Firebase en cliente y servidor

## Riesgo actual

- Hay rutas API administrativas que no validan correctamente la identidad ni el rol del usuario.
- Hay colecciones de Firestore con permisos demasiado amplios para cualquier usuario autenticado.
- La configuración cliente de Firebase tiene valores por defecto hardcodeados que pueden apuntar a un proyecto equivocado.
- El sistema todavía expone demasiados detalles de diagnóstico en frontend.
- El acceso a información del trabajador debe quedar estrictamente limitado a su propia cuenta.

## Reglas de seguridad esperadas

- Las rutas administrativas deben exigir token válido de Firebase.
- Las rutas administrativas deben validar rol antes de procesar cargas, importaciones o extracciones.
- Ningún dato sensible de terceros debe quedar accesible desde consultas manuales o reglas laxas.
- Firestore debe permitir:
  - al trabajador: acceso sólo a lo suyo
  - al admin: acceso operativo donde aplique
  - a nadie más: lectura o escritura por defecto
- Storage debe seguir una lógica equivalente.
- Si faltan credenciales o variables críticas, el sistema debe fallar explícitamente y no caer a defaults inseguros.

## Cambios propuestos

- cerrar rutas API de bolsa de trabajo con verificación real de token y rol
- quitar confianza en `userId` y `userEmail` enviados desde cliente
- endurecer `firestore.rules` por colección en vez de confiar en permisos amplios para autenticados
- revisar `storage.rules` para mantener acceso mínimo necesario
- eliminar defaults hardcodeados de Firebase config
- reducir logs y mensajes que revelan demasiada información en frontend
- documentar el nuevo modelo de seguridad

## Riesgos del cambio

- puede romper flujos admin que hoy dependen de validación laxa
- puede bloquear pantallas si las reglas de Firestore se vuelven más estrictas que el código actual
- puede requerir ajustar scripts operativos o pruebas manuales
- hay riesgo de regresión en el portal del trabajador si se endurecen reglas sin revisar lectura de `users/{uid}` y trámites asociados

## Criterios de aceptacion

- `src/app/api/bolsa-de-trabajo/procesar/route.ts` exige token válido y rol autorizado
- las demás rutas administrativas equivalentes siguen la misma política
- `firestore.rules` deja de permitir `read/write` amplios por simple autenticación en colecciones sensibles
- el trabajador autenticado sólo puede consultar su propia información
- el admin sigue pudiendo operar bolsa de trabajo
- el sistema ya no depende de defaults hardcodeados para Firebase client config
- `typecheck` y `lint` siguen verdes
- existe validación manual mínima como admin y como user

## Validacion

- `npm run typecheck`
- `npm run lint`
- prueba manual como admin:
  - cargar/reemplazar documento
  - publicar quincena
- prueba manual como user:
  - ver dashboard
  - ver sus trámites
- prueba negativa:
  - intentar acceder a rutas admin sin token o con rol no admin

## Pendientes

- definir si la consulta pública manual por matrícula debe seguir viva, limitarse más o retirarse
- revisar si algunas colecciones históricas deben migrarse a reglas más finas por `owner/admin`
- decidir si se implementará rate limiting en esta fase o en una fase posterior
- mientras el portal del trabajador siga leyendo `bolsa_de_trabajo_documentos` y `registros` desde cliente, esas colecciones no pueden cerrarse todavía a `owner-only`; mover esa lectura a server/API sería la siguiente fase natural
