# Feature Spec — Módulo Escalafón (MVP)

## Objetivo

Permitir a la encargada de escalafón subir el listado escalafonario de condicionalidad (PDF generado por SIAP) y que el sistema calcule automáticamente el orden de prelación por plaza, mostrando quién corresponde a cada vacante según el Art. 27 del CCT IMSS-SNTSS.

## Problema actual

El proceso se hace manualmente: la encargada recibe el PDF del SIAP, lo revisa a mano, determina quién corresponde a cada plaza y llama por teléfono al trabajador el día de la nominación. Con categorías de hasta 108 aspirantes y potencialmente 200 plazas liberadas en una quincena, el proceso es lento y propenso a error humano.

## Alcance

**Incluido (MVP):**

- Subida del PDF de listado escalafonario de condicionalidad por categoría
- Parser del PDF SIAP para extraer aspirantes y sus preferencias
- Ingesta y almacenamiento en Firestore
- Vista del listado por categoría con posición, estatus, preferencias y fecha de registro
- Indicar si el listado ya fue subido en el periodo actual (evitar duplicados)

**Fuera de alcance (MVP):**

- Los otros 3 tipos de listado (posiciones por calificación, interinatos, rechazos)
- Motor de asignación automática de plazas vacantes (siguiente fase)
- Notificación digital al trabajador
- Comparación entre periodos / histórico
- Subida masiva de múltiples PDFs a la vez

## Usuarios afectados

- **Encargada de escalafón** — sube el PDF y consulta el listado procesado
- **Administrador SNTSS** — puede ver listados de cualquier categoría
- Sin impacto en portal del trabajador (MVP)

## Estructura del PDF (SIAP)

Cada PDF contiene:

**Encabezado:**

- Delegación, Número de listado, Sector, Fecha de emisión
- Categoría (código + descripción), Área (código + nombre), Convocatoria
- Vigencia (inicio / fin), Periodo de cierre, Número de aspirantes

**Filas de aspirantes** (una por preferencia — un trabajador puede tener múltiples filas):

- `LUG. ESC.` — posición en el ranking (con saltos; no consecutivo)
- `EST` — estatus: `Activo` o `PEI`
- `MAT.` — matrícula del trabajador
- `NOMBRE`
- `DEL` — delegación (usualmente 02)
- `FECHA REG.` — fecha de registro en el listado
- `DELEGACION SOLICITADA` — puede variar o ser la misma delegación
- `ZONA SOLICITADA` — zona específica o `Incondicional`
- `LOCALIDAD SOLICITADA` — localidad específica o `Incondicional`
- `ADSCRIPCION SOLICITADA` — código + nombre de unidad médica, o `Incondicional`
- `TURNO SOLICITADO` — número + texto (ej. `1 Matutino`, `2 Vespertino`, `3 Nocturno`, `5 Jornada Acumulada`) o `Incondicional`. El número 4 existe pero no se ha observado aún.

**Notas del formato:**

- Un trabajador con el mismo `LUG. ESC.` y `MAT.` en múltiples filas = múltiples preferencias del mismo aspirante
- Los valores de zona/localidad pueden venir en mayúsculas o minúsculas indistintamente — normalizar al parsear
- Última página: firmas + observaciones (ignorar al parsear)

## Firestore — Colecciones propuestas

```
escalafon_listados/{listadoId}
  - delegacion: string
  - numeroListado: string          // ej. "2026-1"
  - sector: string                 // ej. "01 ENFERMERIA"
  - fechaEmision: Timestamp
  - categoriaCode: string          // ej. "22210080"
  - categoriaDesc: string          // ej. "ENFERMERA ESPECIALISTA 80"
  - areaCode: string               // ej. "216"
  - areaDesc: string               // ej. "QUIRURGICA"
  - convocatoria: string
  - vigenciaInicio: Timestamp
  - vigenciaFin: Timestamp
  - periodoDecierre: string
  - totalAspirantes: number
  - subidoPor: string              // uid del usuario
  - creadoEn: Timestamp

escalafon_aspirantes/{aspiranteId}
  - listadoId: string              // referencia al listado
  - lugar: number                  // LUG. ESC.
  - estatus: "Activo" | "PEI"
  - matricula: string
  - nombre: string
  - delegacion: string
  - fechaRegistro: Timestamp
  - preferencias: [               // array — una por fila del PDF
      {
        delegacionSolicitada: string | "Incondicional"
        zonaSolicitada: string | "Incondicional"
        localidadSolicitada: string | "Incondicional"
        adscripcionCode: string | "Incondicional"
        adscripcionDesc: string | "Incondicional"
        turnoNum: number | null
        turnoDesc: string | "Incondicional"
      }
    ]
```

## Reglas de negocio

- Un listado se identifica únicamente por `categoriaCode` + `periodoDecierre` — no permitir subir el mismo dos veces
- El `LUG. ESC.` define la prelación dentro del listado de condicionalidad
- Los saltos en `LUG. ESC.` son normales y deben preservarse tal cual
- Normalizar texto de zona/localidad a uppercase al almacenar
- Si el turno viene como número desconocido (ej. 4), almacenarlo como `turnoNum: 4, turnoDesc: "Turno 4"` sin fallar

## Riesgos

| Riesgo                                        | Impacto                       | Mitigación                                                                        |
| --------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| PDF con formato diferente en otras categorías | Parser falla silenciosamente  | Validar total de aspirantes parseados vs. header; alertar si difieren             |
| PDF corrupto o escaneado (no digital)         | No parseable                  | Rechazar con mensaje claro; estos PDFs son generados por SIAP (siempre digitales) |
| Duplicado por re-subida del mismo periodo     | Datos duplicados en Firestore | Validar `categoriaCode + periodoDecierre` antes de insertar                       |
| Nombre partido en dos líneas en el PDF        | Parser rompe el nombre        | Detectar y concatenar líneas incompletas por matrícula                            |

## Criterios de aceptación

- [ ] La encargada puede subir un PDF del listado de condicionalidad
- [ ] El sistema extrae correctamente: metadata del encabezado + todos los aspirantes con sus preferencias
- [ ] El total de aspirantes parseados coincide con el campo `NUMERO DE ASPIRANTES` del PDF
- [ ] Un trabajador con múltiples preferencias aparece como un solo aspirante con array de preferencias
- [ ] No se puede subir el mismo listado (misma categoría + periodo) dos veces
- [ ] La vista muestra el listado ordenado por `LUG. ESC.` con todos los datos relevantes
- [ ] El parser no falla ante valores desconocidos — los almacena tal cual

## Validación

- **Técnica:** correr el parser contra los 3 PDFs de muestra (quirúrgica 108 aspirantes, pediatría 36, farmacia 59) y verificar conteos exactos
- **Manual:** la encargada valida que los datos del sistema coincidan con el PDF impreso
- **Regresión:** los 3 PDFs de muestra se convierten en fixtures del test suite

## Auth — Rol y permisos

Nuevo rol: `ESCALAFON` (análogo al rol `BOLSA`).

Nuevos permisos a agregar en `src/types/roles.ts`:

```ts
// Escalafón
CARGAR_ESCALAFON = "CARGAR_ESCALAFON",
PROCESAR_ESCALAFON = "PROCESAR_ESCALAFON",
VER_ESCALAFON = "VER_ESCALAFON",
ELIMINAR_ESCALAFON = "ELIMINAR_ESCALAFON",
EXPORTAR_ESCALAFON = "EXPORTAR_ESCALAFON",
```

Mapeo de permisos por rol:

| Rol           | Permisos                                  |
| ------------- | ----------------------------------------- |
| `SUPER_ADMIN` | Todos                                     |
| `ADMIN`       | VER, CARGAR, PROCESAR, ELIMINAR, EXPORTAR |
| `ESCALAFON`   | VER, CARGAR, PROCESAR, ELIMINAR, EXPORTAR |
| `REVISOR`     | VER, EXPORTAR                             |
| `CONSULTA`    | VER                                       |

## UI — Rutas y vistas

Estructura espejo de bolsa de trabajo (`/admin/bolsa-de-trabajo`):

```
/admin/escalafon                        → página principal (listado de quincenas)
/admin/escalafon/cargar                 → subir PDF del listado de condicionalidad
/admin/escalafon/quincenas              → historial de periodos subidos
/admin/escalafon/quincenas/[syncId]     → detalle de una quincena (listados por categoría)
/admin/escalafon/[listadoId]            → detalle de un listado (tabla de aspirantes)
```

**Sidebar:** entrada "Escalafón" visible solo para roles con `VER_ESCALAFON`.

### Flujo de la encargada

1. Entra a `/admin/escalafon/cargar`
2. Selecciona el PDF del listado de condicionalidad
3. El sistema parsea, valida y muestra preview con: categoría, área, número de aspirantes parseados vs. esperados
4. Confirma → se guarda en Firestore bajo la quincena activa
5. Regresa al listado de quincenas y ve el nuevo listado publicado

### Vista de quincena (`/admin/escalafon/quincenas/[syncId]`)

- Tarjetas o tabla con los listados subidos en ese periodo
- Por cada listado: categoría, área, total aspirantes, fecha de subida, estado
- Botón para ver el detalle del listado

### Vista de listado (`/admin/escalafon/[listadoId]`)

- Header con metadata del listado (categoría, área, vigencia, convocatoria)
- Tabla de aspirantes ordenada por `LUG. ESC.` con columnas:
  - Lugar, Estatus, Matrícula, Nombre, Fecha Reg., Preferencias (expandible)
- Las preferencias múltiples de un mismo aspirante se muestran colapsadas / en chip

## Notas

- El parser debe usar el mismo pipeline que bolsa de trabajo (Adobe SDK / pdfplumber según complejidad)
- Los PDFs del SIAP son siempre digitales — no hay casos de scan
- La implementación del motor de asignación de plazas es la siguiente fase — este spec solo cubre ingesta y visualización
- Confirmar con encargada si el número de turno 4 existe y qué significa antes de cerrar la fase 2
- El sidebar y las guards de ruta siguen el mismo patrón que el módulo BOLSA — copiar y adaptar
