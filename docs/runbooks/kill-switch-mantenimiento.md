# Runbook — Kill-switch de mantenimiento

Interruptor para suspender toda la plataforma (portal admin y portal trabajador) mostrando una pantalla de mantenimiento. Es una palanca **operativa/de cobranza**, no un modo de despliegue rutinario.

## Cómo funciona

- **Gate server-side** en el layout raíz (`src/components/MaintenanceGate.tsx`, montado desde `src/app/layout.tsx`). Si el estado está activo, el servidor renderiza `MantenimientoScreen` en lugar de la app. No es bypasseable desde el cliente.
- **Estado** en Firestore `config/plataforma` (`mantenimientoActivo`), leído por `src/lib/firebase/mantenimiento.ts` con cache en memoria (TTL 30 s → esa es la latencia máxima de propagación al prender/apagar). El doc está blindado por el catch-all de `firestore.rules`; solo el Admin SDK lo toca.
- **Default seguro:** si el doc no existe → plataforma operativa. Si Firestore no responde → _fail-open_ (asume operativa, no tumba el servicio).
- **Anti-lockout:** el operador con la cookie `mant_bypass` (valor = `MAINTENANCE_CONTROL_SECRET`, comparado en tiempo constante) queda exento del gate y sigue viendo la app para poder reactivar.

## Requisito de entorno

`MAINTENANCE_CONTROL_SECRET` debe existir en las variables de producción (Vercel). Sin él, el control no responde y el bypass no funciona. Generar uno largo y aleatorio: `openssl rand -hex 24`.

## Cómo accionarlo

### Vía recomendada — dashboard admin

1. Entrar al dashboard admin como usuario `isDeveloper`.
2. Usar el toggle de mantenimiento (`MantenimientoToggle`). Muestra estado Operativa/Suspendida con confirmación.
3. El endpoint `/api/admin/mantenimiento` (protegido con `requireDeveloperRequest`) siembra automáticamente la cookie de bypass, así que **no te encierras** y no necesitas conocer el secreto.

### Vía de respaldo — bookmark

Si entras desde un dispositivo sin la cookie de bypass:

```
https://sntssvii.com/api/z-control?k=<MAINTENANCE_CONTROL_SECRET>
```

Route handler fuera del gate. Sin el secreto correcto → 404. Requiere conocer el valor del secreto (si está como tipo "Secret" en Vercel y no lo tienes, hay que regenerar y actualizar la env var).

## Si te quedas fuera (lockout)

1. Abre el bookmark de respaldo `/api/z-control?k=<secreto>` para recuperar la cookie de bypass o apagar el mantenimiento.
2. Si no tienes el secreto: actualiza `MAINTENANCE_CONTROL_SECRET` en Vercel con un valor nuevo, redeploy, y usa el bookmark con el valor nuevo.
3. Último recurso: poner `mantenimientoActivo: false` directo en el doc `config/plataforma` desde la consola de Firebase.

## Estrategia de uso

Es carta de respaldo, **no** primer movimiento. Secuencia recomendada: primero recordatorio de pago; kill-switch solo si dan largas. Suspensiones cortas en día clave pesan más que una caída prolongada (esta última quema buena voluntad). La pantalla de bloqueo es neutral ("mantenimiento programado"), sin mención de pagos.

## Ensayo previo recomendado

Antes de depender del switch en un momento crítico, hacer un ciclo de prueba en un rato tranquilo: prender → confirmar que un usuario normal ve la pantalla → confirmar que el operador con bypass sigue entrando → apagar.
