# Spec: Validación y Seguridad en Publicación de Bolsa de Trabajo

**Fecha:** 2026-06-10
**Autor:** Gerardo Arroyo + Emma
**Estado:** Aprobado — listo para plan de implementación

## Contexto

El 2026-06-09 se detectó un bug en `isZonaIncondicional` que causó que las posiciones de la quincena 2 mayo se materializaran sin prioridad incondicional. Al publicar la quincena 1 junio (con el bug ya corregido), los trabajadores vieron sus posiciones "subir" (empeorar), generando desconfianza pública. Se enviaron 570 correos de corrección.

Este spec define un sistema de validación y prevención de regresiones para que ningún error similar llegue a los trabajadores sin detección previa.

## Objetivo

Agregar tres capas de protección al flujo de publicación de bolsa:

1. **Pre-publicación:** wizard de validación guiada que el admin debe completar antes de publicar
2. **En publicación:** análisis automático de regresión que alerta si >10% de trabajadores retroceden por tipo de documento
3. **Post-publicación:** herramientas de emergencia (ocultar portal / revertir a quincena anterior) y diff histórico

## Alcance

**Incluye:**

- Endpoint `POST /api/bolsa-de-trabajo/pre-publicar` (solo lectura)
- Endpoint `POST /api/bolsa-de-trabajo/revertir`
- Wizard de 4 pasos en panel admin (pre-publicación)
- Zona de peligro post-publicación (ocultar / revertir)
- Vista de diff histórico en panel admin
- Changelog automático guardado en documento de sync

**No incluye:**

- Historial de posiciones visible al trabajador en el portal
- Tests de contrato por estrategia (mejora de código separada)
- Notificaciones automáticas a trabajadores por cambios de posición

## Arquitectura

### Flujo de publicación modificado

```
[Listados cargados y procesados]
          ↓
  POST /pre-publicar          ← nuevo, solo lectura
  → regresión + muestras
          ↓
  [Wizard de validación — 4 pasos]
          ↓
  POST /publicar              ← igual que hoy + guarda resumenRegresion
          ↓
  [Publicado]
  [Zona de peligro: Ocultar / Revertir]
```

### Nuevos archivos

| Archivo                                              | Responsabilidad                                |
| ---------------------------------------------------- | ---------------------------------------------- |
| `src/lib/bolsa-de-trabajo/regression-analyzer.ts`    | Compara posiciones nueva sync vs sync anterior |
| `src/lib/bolsa-de-trabajo/validation-sampler.ts`     | Selecciona casos representativos por documento |
| `src/app/api/bolsa-de-trabajo/pre-publicar/route.ts` | Endpoint pre-publicación (solo lectura)        |
| `src/app/api/bolsa-de-trabajo/revertir/route.ts`     | Rollback y ocultar                             |

### Archivos modificados

| Archivo                                          | Cambio                                                   |
| ------------------------------------------------ | -------------------------------------------------------- |
| `src/app/api/bolsa-de-trabajo/publicar/route.ts` | Guarda `resumenRegresion` y `syncAnteriorId` al publicar |
| Panel admin (componente de publicación)          | Reemplaza botón "Publicar" por wizard                    |

## Cambios al modelo de datos

### `sincronizaciones/{syncId}` — campos nuevos

```ts
oculto: boolean
// Cuando true, el portal del trabajador muestra "listado en actualización"
// Default: false

syncAnteriorId: string | null
// ID de la sync que estaba activa antes de publicar esta
// Usado para rollback

resumenRegresion: {
  porTipo: Record<TipoBolsaDeTrabajo, {
    total: number
    avanzaron: number
    retrocedieron: number
    sinCambio: number
    porcentajeRetroceso: number
  }>
  alertaDisparada: boolean
  sinComparacion: boolean          // true si no había sync anterior
  confirmadoPor: string            // uid del admin que confirmó publicación
  fechaConfirmacion: Timestamp
} | null
// Guardado al publicar. null si la sync fue publicada antes de este sistema.
```

## Componentes backend

### `regression-analyzer.ts`

Recibe: `syncId` (nueva, no publicada aún), `syncAnteriorId`

Lógica:

1. Si no hay `syncAnteriorId` → retorna `{ sinComparacion: true }`
2. Carga posiciones materializadas de la sync anterior (`bolsa_posiciones_materializadas` where `syncId == syncAnteriorId`)
3. Calcula posiciones de la sync nueva en memoria usando `materializeDocumentPositions` (sin escribir a Firestore)
4. Cruza por matrícula + tipoDocumento + grupo comparable
5. Por cada `tipoDocumento`, cuenta avanzaron / retrocedieron / sinCambio
6. `alertaDisparada = true` si cualquier tipo supera 10% de retroceso

```ts
export interface RegressionAnalysis {
  sinComparacion: boolean;
  alertaDisparada: boolean;
  porTipo: Record<string, TipoRegressionStats>;
  syncAnteriorId: string | null;
}

export interface TipoRegressionStats {
  total: number;
  avanzaron: number;
  retrocedieron: number;
  sinCambio: number;
  porcentajeRetroceso: number;
}
```

### `validation-sampler.ts`

Recibe: registros + posiciones calculadas en memoria por documento

Por cada documento, selecciona hasta 5 casos representativos:

1. Trabajador de zona incondicional con menor `posicionBase` (si existe)
2. Trabajador con `posicionBase = 1` (primer lugar en su grupo)
3. Trabajador con posición media del documento
4. Trabajador eventual (`tipoContratacion = '8'`) si aplica
5. Un caso aleatorio diferente a los anteriores

Cada caso incluye: `matricula`, `nombre`, `categoria`, `zona`, `posAnterior | null`, `posNueva`, `delta`

### `POST /api/bolsa-de-trabajo/pre-publicar`

Auth: requiere permiso BOLSA
Body: `{ syncId: string }`

Proceso:

1. Carga documentos COMPLETADO de la sync
2. Calcula posiciones en memoria (sin escribir)
3. Corre regression analyzer
4. Corre validation sampler
5. Retorna todo sin modificar Firestore

Respuesta:

```ts
{
  regresion: RegressionAnalysis;
  muestras: Record<string, CasoRepresentativo[]>; // key = documentoId
  documentos: {
    id: string;
    tipo: string;
    totalRegistros: number;
  }
  [];
  syncAnteriorId: string | null;
}
```

Idempotente — puede llamarse múltiples veces sin efecto secundario.

### `POST /api/bolsa-de-trabajo/revertir`

Auth: requiere permiso BOLSA
Body: `{ syncId: string; accion: 'OCULTAR' | 'MOSTRAR' | 'REVERTIR' }`

**OCULTAR / MOSTRAR:**

- Actualiza `oculto: true/false` en la sync activa
- Registra en audit log

**REVERTIR:**

- Requiere que la sync tenga `syncAnteriorId`
- Si no existe sync anterior: error 400
- Verifica que la sync anterior tiene posiciones materializadas
- En batch: `syncActual.esFuenteVerdad = false`, `syncAnterior.esFuenteVerdad = true`
- Registra en audit log con `accion: 'BOLSA_REVERTIR_SYNC'`

### Modificación a `POST /api/bolsa-de-trabajo/publicar`

Al publicar, además de lo actual:

1. Guarda `syncAnteriorId` (ID de la sync que tenía `esFuenteVerdad = true` antes)
2. Guarda `resumenRegresion` con los datos del análisis (recibe el análisis como parámetro del body, calculado en el frontend durante el wizard)
3. El campo `confirmadoPor` se toma del usuario autenticado

Body extendido:

```ts
{
  syncId: string
  resumenRegresion: RegressionAnalysis  // calculado en /pre-publicar, reenviado aquí
  confirmadoPor?: string                // uid, llenado por el servidor
}
```

## Componentes frontend (panel admin)

### Wizard de publicación — 4 pasos

Reemplaza el botón "Publicar" actual. Se abre como página dedicada o drawer full-height.

**Paso 1 — Documentos incluidos**

- Lista de documentos: tipo, nombre archivo, total registros, fecha carga
- Checkbox: "He verificado que estos son los listados correctos para esta quincena"
- Botón: Siguiente →

**Paso 2 — Análisis de movimiento**

- Tabla por tipo con semáforo: verde (≤10% retroceso) / rojo (>10%)
- Columnas: Tipo | Total | Avanzaron | Retrocedieron | Sin cambio | % Retroceso
- Banner rojo si `alertaDisparada = true`: "Detectamos movimiento inusual en uno o más listados. Revisa las muestras antes de continuar."
- Si `sinComparacion = true`: banner gris "Primera publicación — sin datos de comparación disponibles."
- Botón: Siguiente →

**Paso 3 — Revisión de muestras**

- Acordeón por documento (cerrado por default, expandir para revisar)
- Tabla por documento: Matrícula | Nombre | Grupo | Pos. anterior | Pos. nueva | Delta
- Delta con color: verde si mejoró, rojo si empeoró, gris si igual
- Admin no necesita aprobar cada caso — solo revisar
- Botón: Siguiente →

**Paso 4 — Confirmación final**

- Resumen compacto: X documentos, Y trabajadores, alerta: sí/no
- Si `alertaDisparada = true`: input de texto donde el admin debe escribir `CONFIRMAR` antes de habilitar el botón
- Checkbox: "Confirmo que he revisado los datos y autorizo la publicación de esta quincena"
- Botón primario: **Publicar quincena**

### Zona de peligro post-publicación

Acordeón colapsado por default ("Acciones de emergencia"), visible solo si la sync es la activa.

**Ocultar portal temporalmente**

- Toggle con descripción: "Los trabajadores verán 'El listado está en proceso de actualización' hasta que reactives el portal."
- Sin confirmación adicional (reversible inmediatamente)

**Revertir a quincena anterior**

- Solo visible si `syncAnteriorId` existe
- Input: escribir `REVERTIR` para confirmar
- Descripción: "Esto desactivará la quincena actual y reactivará [periodo anterior]. Los trabajadores volverán a ver las posiciones anteriores."
- Botón rojo: Revertir

### Vista de diff histórico

Pestaña "Movimientos" en el detalle de una sync publicada.

- Badge en listado de syncs: `↑ 423 / ↓ 89 / — 494` (leído de `resumenRegresion`)
- En detalle: tabla completa filtrable
  - Columnas: Matrícula | Nombre | Tipo | Grupo | Pos. anterior | Pos. nueva | Delta
  - Filtros: tipo de documento, solo retrocesos, solo avances, búsqueda por matrícula
  - Export CSV
- Para syncs sin `resumenRegresion` (publicadas antes de este sistema): mensaje "Datos de movimiento no disponibles para esta quincena."

## Portal del trabajador

Cuando `oculto = true` en la sync activa, el endpoint `GET /api/trabajador/posicion` retorna:

```json
{
  "error": "El listado está en proceso de actualización. Intenta de nuevo en breve.",
  "code": "SYNC_HIDDEN"
}
```

El portal muestra un banner informativo, no un error técnico.

## Permisos

Todas las nuevas acciones usan el permiso existente BOLSA. No se requieren permisos nuevos.

| Acción                        | Permiso requerido  |
| ----------------------------- | ------------------ |
| `POST /pre-publicar`          | BOLSA              |
| `POST /publicar` (modificado) | BOLSA (sin cambio) |
| `POST /revertir`              | BOLSA              |
| Ver diff histórico            | BOLSA              |

## Manejo de errores

| Escenario                                             | Comportamiento                     |
| ----------------------------------------------------- | ---------------------------------- |
| `/pre-publicar` con sync sin documentos               | 400 SYNC_WITHOUT_DOCUMENTS         |
| `/pre-publicar` con documentos incompletos            | 400 SYNC_HAS_INCOMPLETE_DOCUMENTS  |
| `/revertir REVERTIR` sin sync anterior                | 400 NO_PREVIOUS_SYNC               |
| `/revertir REVERTIR` con sync anterior sin posiciones | 400 PREVIOUS_SYNC_NOT_MATERIALIZED |
| Portal con `oculto: true`                             | 503 SYNC_HIDDEN (mensaje amigable) |

## Criterios de aceptación

- [ ] Admin no puede publicar sin completar los 4 pasos del wizard
- [ ] Si >10% retroceden en cualquier tipo, el paso 4 requiere escribir CONFIRMAR
- [ ] El rollback reactiva la sync anterior en menos de 5 segundos
- [ ] Ocultar/mostrar portal es instantáneo y reversible
- [ ] El diff histórico muestra todos los movimientos de la quincena
- [ ] `resumenRegresion` queda guardado en Firestore al publicar
- [ ] Todas las acciones quedan en el audit log
- [ ] El portal muestra mensaje amigable cuando está oculto
- [ ] `/pre-publicar` es idempotente (no modifica estado)
- [ ] Sin sync anterior, el wizard funciona sin errores (modo sin comparación)
