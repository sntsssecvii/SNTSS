# Cambios de escalafon en portal del trabajador

Mostrar la posicion del trabajador en listados de cambios de escalafon (turno, adscripcion, etc.) dentro de la seccion "Mi Escalafon" del dashboard, unificada con las cards de promocion existentes.

## Contexto

- **Escalafon (promocion)** ya tiene portal del trabajador: colecciones `escalafon_listados` + `escalafon_aspirantes`, endpoint `/api/trabajador/escalafon-posicion`, seccion "Mi Escalafon" en dashboard.
- **Cambios de escalafon** solo tiene vista admin: colecciones `cambios_listados` + `cambios_registros`, motor en `position-engine.ts` que calcula posiciones al vuelo.
- El trabajador no puede ver su posicion en cambios. Este spec cierra esa brecha.

## Alcance

- Materializar posiciones al subir/re-subir un listado de cambios
- Endpoint del trabajador para consultar su posicion
- Cards de cambios integradas en la seccion "Mi Escalafon" del dashboard

## 1. Materializacion — campos nuevos en `cambios_registros`

Al subir un listado en `POST /api/cambios-escalafon/procesar`, despues de guardar los registros, correr `calcularPosicionesCambios()` y actualizar cada doc con:

```ts
{
  lugar: number; // posicion en su grupo (1 = primero)
  totalEnGrupo: number; // total competidores en ese grupo
  grupoUnidad: string; // unidad donde compite (e.g. "HGR 01")
  grupoTurno: string; // turno donde compite (e.g. "VESPERTINO")
}
```

### Incondicionales

Un incondicional genera multiples posiciones (una por cada turno/unidad de su zona). Se guarda la **mejor posicion** (lugar mas bajo) como campos principales del doc. El campo `grupoUnidad` y `grupoTurno` reflejan el grupo donde tiene mejor posicion.

### Re-subida

Al re-subir un listado (auto-reemplazo por categoria + concepto + area), los registros viejos se borran y los nuevos se crean con posiciones ya materializadas. No hay migracion incremental.

### Registros existentes

Los listados ya subidos no tendran posiciones materializadas. Opciones:

- Script de migracion one-shot que recalcula y actualiza los registros existentes
- O re-subir los listados (la encargada ya lo hace cuando hay correcciones)

Recomendar el script de migracion para no depender de re-subidas manuales.

## 2. Endpoint `GET /api/trabajador/cambios-posicion`

Mismo patron que `/api/trabajador/escalafon-posicion`:

- `requireUserRequest(request)` para auth
- `enforceRateLimitRedis` bucket `api:trabajador:cambios-posicion`, 20 req/min
- `assertSameOrigin(request)` para CORS
- Query `cambios_registros` por `matricula`
- Para cada registro, traer el `cambios_listados` correspondiente (join por `listadoId`)

### Response shape

```ts
{
  success: true,
  data: Array<{
    listadoId: string;
    categoriaCode: string;
    categoriaDesc: string;   // con naming enfermeria aplicado
    concepto: string;        // "" | "014" | "054"
    fechaEmision: string;
    tipo: string;            // "TURNO" | "ADSCRIPCION" | ...
    zona: string;            // "2-MEXICALI"
    adscripcionSolicitada: string;  // "HGR 01" | "0-INCONDICIONAL"
    turnoSolicitado: string; // "VESPERTINO" | "INCONDICIONAL"
    lugar: number;
    totalEnGrupo: number;
    grupoUnidad: string;     // donde compite (puede diferir de adscripcionSolicitada para incondicionales)
    grupoTurno: string;
  }>
}
```

Registros sin `lugar` materializado se omiten del response (listados viejos pre-migracion).

## 3. Cliente — `trabajador-portal.ts`

Nueva funcion:

```ts
export async function getMisCambiosEscalafonCliente(): Promise<{
  data: CambiosPosicionResult[];
}>;
```

Tipo `CambiosPosicionResult` en `src/types/cambios-escalafon.ts` con los campos del response.

## 4. Dashboard — seccion "Mi Escalafon" unificada

### Fetch

Agregar `useEffect` que llame `getMisCambiosEscalafonCliente()` en paralelo con `getMiEscalafonCliente()`. Estado: `cambiosEscalafon: CambiosPosicionResult[]`.

### Cards

Las cards de cambios se renderizan junto a las de promocion en la misma grid. El contador del header suma ambos.

**Card de cambio:**

- **Titulo:** `categoriaDesc` (con naming enfermeria)
- **Numero hero:** `lugar`
- **Subtitulo:** `tipo` + `grupoUnidad` + `grupoTurno` (e.g. "TURNO - HGR 01 - VESPERTINO")
- **Badge superior:** "Cambio" (para distinguir de "Promocion" en las cards existentes)
- **Badge secundario:** concepto si aplica ("C-014", "C-054") o "Sin concepto"

**Card de promocion (existente):**

- Agregar badge "Promocion" para distinguir

### Modal

Click en card de cambio abre un modal similar al de promocion:

- Hero con posicion y total ("Lugar 3 de 12")
- Datos: tipo de cambio, zona, unidad solicitada, turno, concepto, fecha de emision
- No muestra zonas multiples (a diferencia de promocion que tiene `posicionesPorZona`)

## Archivos a modificar

| Archivo                                                  | Cambio                                            |
| -------------------------------------------------------- | ------------------------------------------------- |
| `src/app/api/cambios-escalafon/procesar/route.ts`        | Correr motor y materializar posiciones al guardar |
| `src/app/api/trabajador/cambios-posicion/route.ts`       | Nuevo endpoint                                    |
| `src/lib/firebase/trabajador-portal.ts`                  | `getMisCambiosEscalafonCliente()`                 |
| `src/types/cambios-escalafon.ts`                         | Tipo `CambiosPosicionResult`                      |
| `src/app/(main)/dashboard/page.tsx`                      | Fetch + cards + modal de cambios                  |
| `src/lib/cambios-escalafon/especialidades-enfermeria.ts` | Reusar para naming en endpoint                    |

### Archivo nuevo

| Archivo                                                 | Proposito                                 |
| ------------------------------------------------------- | ----------------------------------------- |
| `scripts/migrations/materializar-cambios-posiciones.ts` | Script one-shot para registros existentes |

## Fuera de alcance

- Notificaciones push/email cuando cambia la posicion
- Historico de posiciones (snapshots por quincena)
- Colas de cambios a-f (Fase 3 del modulo escalafon)
