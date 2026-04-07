# Security Spec: Hardening del registro y preparación para 16,000 usuarios

## Objetivo

Endurecer el flujo de registro de SNTSS para reducir exposición de seguridad, evitar estados inconsistentes y dejar una ruta operable para una campaña de alta concurrencia con expectativa de 16,000 usuarios registrados.

## Superficie afectada

- flujo de registro en frontend
- rutas API de registro y validación
- Firebase Auth
- Firestore `users` y `notifications`
- Storage `uploads/{userId}/...`
- envío de correo y side effects operativos
- panel admin de validaciones y administración global

## Riesgo actual

- El registro hoy se orquesta desde cliente: crea cuenta, sube archivos, escribe `users`, crea notificaciones y dispara correo.
- No existe un endpoint de registro con rate limiting centralizado ni auditoría del intento.
- Si falla una etapa intermedia, pueden quedar cuentas huérfanas en Auth o perfiles incompletos.
- El login persiste credenciales sensibles del admin en `sessionStorage`, lo que amplifica cualquier XSS o acceso al navegador.
- Las pantallas admin todavía tienen lecturas completas de usuarios por estatus o de toda la colección, lo que degrada operación con 16,000 registros.

## Reglas de seguridad esperadas

- El registro público debe entrar por una ruta backend propia con validación server-side.
- La ruta de registro debe aceptar solo payload y archivos permitidos, con límites explícitos de tamaño.
- La creación de cuenta no debe depender de credenciales administrativas almacenadas en el navegador.
- El sistema debe dejar trazabilidad mínima de intentos exitosos y fallidos de registro.
- Ningún usuario pendiente debe obtener acceso funcional al portal más allá de confirmar que su solicitud existe.
- El admin debe validar usuarios desde endpoints protegidos, paginados y con filtros server-side.
- Los side effects secundarios como correo y notificaciones no deben comprometer el resultado principal del alta.

## Cambios propuestos

- crear `POST /api/registro` como único punto de entrada para altas nuevas
- mover validación de datos y archivos a servidor usando el schema compartido
- crear usuario con Admin SDK y marcarlo inicialmente con `status: pending`
- subir documentos a Storage desde servidor o mediante flujo firmado/controlado
- registrar documento `users/{uid}` y side effects con estrategia idempotente
- dejar correo y notificaciones como side effects tolerantes a fallos
- eliminar persistencia de contraseñas administrativas en navegador
- endurecer la política real de contraseña del registro
- paginar validaciones admin y administración global por cursor/filtros
- agregar límites de tráfico durables para registro y acciones de validación

## Riesgos del cambio

- mover registro a servidor puede requerir ajustar reglas, permisos y pruebas manuales
- una migración incompleta puede romper temporalmente el alta pública
- la paginación admin cambia contratos de frontend y exige adaptación cuidadosa
- para 16,000 usuarios puede ser necesario confirmar cuotas operativas de Firebase Auth, Firestore, Storage y Resend antes del lanzamiento

## Criterios de aceptacion

- el registro ya no crea cuentas completas desde cliente
- no se almacenan contraseñas administrativas en `sessionStorage`
- la contraseña mínima del registro refleja la política real del sistema
- el endpoint de registro responde `429` ante abuso básico
- un fallo de correo no revierte ni falsifica el estado del alta principal
- el sistema evita o recupera cuentas huérfanas si una fase intermedia falla
- validaciones admin y administración global dejan de cargar listas completas para el camino normal
- `npm run typecheck` y `npm run lint` siguen verdes

## Validacion

- `npm run typecheck`
- `npm run lint`
- prueba manual de registro exitoso
- prueba manual de registro con correo duplicado
- prueba manual de archivos inválidos o demasiado grandes
- prueba negativa de rate limit en registro
- prueba manual de validación admin con paginación/filtros

## Pendientes

- decidir si el alta debe crear el usuario en Auth antes o después de confirmar persistencia documental
- definir estrategia final de rollback para cuentas huérfanas
- confirmar si conviene colar correos/notificaciones a cola asíncrona o mantener side effects inline tolerantes a fallo
- confirmar capacidad y cuotas de proveedores para una ventana de registro concentrada
