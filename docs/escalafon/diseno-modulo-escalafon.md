# Módulo de Escalafón — Diseño

## Objetivo

Automatizar el proceso de nominación escalafonaria que hoy realiza manualmente la encargada del escalafón en la Sección Baja California del SNTSS.

El sistema debe responder a la pregunta: **¿A quién le corresponde una plaza vacante?** de forma automática, trazable y accesible para el trabajador desde su portal.

Este documento es el contrato de diseño del módulo. Todo desarrollo debe derivar de aquí.

---

## Contexto del problema

### Cómo trabaja hoy la encargada

Cada quincena, el IMSS le entrega a la encargada un listado generado por el sistema **SIAF** (Sistema de Información Administrativa y Financiera). Ese listado ya trae calculada la posición escalafonaria de cada trabajador — no hay que recalcular nada.

Actualmente ella:

1. Imprime los listados quincenales y los guarda en carpetas físicas por categoría.
2. Cuando se libera una plaza, recibe llamadas de trabajadores preguntando si les toca.
3. Revisa manualmente las carpetas en orden de prioridad.
4. Determina mentalmente quién califica para esa plaza específica.
5. Emite el dictamen.

Está saturada. El sistema resuelve exactamente eso.

### Fuente legal

Todo lo documentado aquí deriva del **Reglamento de Escalafón** contenido en el CCT IMSS-SNTSS 2025-2027, Artículos 17 al 44. El documento se encuentra en `artifacts/contrato-colectivo-de-trabajo-2025-2027.pdf`.

---

## Reglas de negocio

### 1. Factores de calificación (Art. 29-31)

El SIAF ya calcula el puntaje. El sistema no necesita recalcularlo — solo ingiere el listado. Para referencia:

| Factor     | Máximo      | Fuente                                                                                     |
| ---------- | ----------- | ------------------------------------------------------------------------------------------ |
| Eficiencia | 60 pts      | Calificación del Requisito 51 (curso) o certificado académico, transformada a escala de 60 |
| Antigüedad | 40 pts      | Años de servicio al IMSS, máximo computable 30 años                                        |
| **Total**  | **100 pts** | Suma de ambos factores                                                                     |

**Cálculo de antigüedad (para referencia, no implementar):**

```
puntos = años × 1.3333  (máx. 30 años = 40 puntos)
días adicionales = (1.3333 / 360) × días_laborados
```

No computa: faltas injustificadas, licencias sin sueldo, licencias para puesto de confianza.

**Desempate:** En caso de puntaje igual, gana quien tenga mayor antigüedad escalafonaria.

### 2. Orden de prelación para nominar una plaza (Art. 27) — LA REGLA MÁS IMPORTANTE

Cuando se libera una plaza, el sistema recorre esta cascada en orden. La primera cola con candidato válido detiene la búsqueda.

```
a) Cambio de turno — trabajador ya percibe concepto 14, 54 o 61
b) Cambio de área — misma adscripción y turno, sin concepto 14/54/61
c) Cambio de tipo de plaza — de cubre vacaciones/cubre descansos a operativa
d) Cambio de turno — sin concepto 14/54/61
e) Cambio de adscripción — trabajador ya percibe concepto 14, 54 o 61
f) Cambio de adscripción — sin concepto, por fecha de registro (FIFO)
g) Confirmación de interinos a plaza definitiva
h) Promoción escalafonaria  ← aquí aplica el listado del SIAF
i) Cambio de residencia
```

**Regla crítica:** Un trabajador con cambio registrado (colas a-i) tiene prioridad sobre el #1 del listado de promoción, sin importar el puntaje.

### 3. Tipos de plaza y restricciones de matching (Art. 27)

Cada tipo de movimiento tiene restricciones de qué plazas puede ocupar:

| Tipo                    | Restricciones                                                                     |
| ----------------------- | --------------------------------------------------------------------------------- |
| Cambio de turno         | Misma adscripción, misma categoría y sector, misma jornada o reducción            |
| Cambio de área          | Plazas con concepto 14/54/61, misma adscripción y turno                           |
| Cambio de adscripción   | Misma categoría y sector, misma jornada                                           |
| Ampliación de jornada   | Cualquier adscripción y turno, misma categoría y sector                           |
| Interinos               | Solo vacantes definitivas, misma categoría y sector del interinato                |
| Promoción escalafonaria | Vacantes definitivas o no definitivas, misma rama, sector y categoría del listado |
| Cambio de residencia    | De una delegación a otra                                                          |

### 4. Preferencias del trabajador: condicionado vs incondicional (Art. 31 Bis)

Cada trabajador, al inscribirse al Requisito 51, declara su preferencia:

| Tipo              | Qué significa                                                                  |
| ----------------- | ------------------------------------------------------------------------------ |
| **Condicionado**  | Acepta solo plazas en hasta 3 combinaciones específicas de adscripción + turno |
| **Incondicional** | Acepta cualquier plaza disponible en su delegación, zona o localidad           |

Si el #1 del listado es condicionado y la plaza vacante no coincide con ninguna de sus 3 preferencias, se le salta y va al #2.

### 5. Aceptación y rechazo (Art. 40)

El trabajador nominado tiene **3 días hábiles** para aceptar o rechazar a partir del citatorio. Si rechaza, el sistema nomina al siguiente candidato válido.

### 6. Fecha de generación de la vacante (Art. 31)

Las plazas vacantes se aplican al listado escalafonario **vigente en la fecha en que se generó la vacante**, no en la fecha en que se tramita. Si una plaza se generó antes del último listado quincenalse aplica al listado anterior.

Este dato es crítico y debe capturarse obligatoriamente al registrar una plaza vacante.

### 7. Causales de vacante definitiva (Art. 17)

Una plaza se convierte en vacante definitiva cuando su titular la deja por:

- Muerte
- Renuncia
- Liquidación
- Promoción a otra plaza (definitiva)
- Jubilación
- Invalidez permanente
- Sentencia ejecutoriada que impida laborar
- Rescisión no objetada o demanda improcedente
- Ocupar plaza de confianza definitiva

### 8. Vacantes temporales (Art. 19 y 42)

Las vacantes por ausencia mayor a 30 días generan plaza temporal. Si la ausencia es mayor a 90 días, se cubre de inmediato con dictamen interino siguiendo el mismo procedimiento que las definitivas.

---

## Arquitectura del sistema

### Flujo general

```
SIAF (quincena)
    │
    ▼
[Importación de listado]  ←  PDF o Excel cargado por la encargada
    │
    ▼
Firestore: escalafon_listados
    │
    ├─── Trabajador se registra en portal
    │         - matrícula, tipo (condicionado/incondicional)
    │         - si condicionado: hasta 3 {adscripción, turno}
    │         Firestore: escalafon_trabajadores
    │
    ├─── Encargada registra registros de cambio
    │         - tipo de cambio, fecha de registro, preferencias
    │         Firestore: escalafon_registros_cambio
    │
    └─── Encargada captura plaza vacante
              - categoría, sector, rama, adscripción, turno, jornada
              - fecha de generación (obligatoria)
              - tipo: definitiva | temporal
              │
              ▼
        [Motor de cascada]
              │
              ▼
        Resultado: trabajador nominado + justificación
              │
              ▼
        Encargada confirma nominación
              │
              ├── Trabajador notificado: "Fuiste nominado, tienes 3 días"
              └── Trabajador acepta/rechaza
                    └── Si rechaza: motor nomina al siguiente
```

### Colecciones Firestore

#### `escalafon_listados`

Registro de cada listado importado del SIAF.

```typescript
{
  id: string                    // auto
  fechaImportacion: Timestamp
  quincena: string              // e.g. "2026-04-01" (inicio de quincena)
  categoria: string             // categoría del listado
  sector: string
  rama: string
  delegacion: string
  archivoNombre: string
  importadoPor: string          // uid del admin
  trabajadores: ListadoTrabajador[]
}

type ListadoTrabajador = {
  posicion: number              // posición en el listado (ya calculada por SIAF)
  matricula: string
  nombre: string
  puntajeTotal: number          // eficiencia + antigüedad
  puntajeEficiencia: number
  puntajeAntiguedad: number
  antiguedadAnios: number
  categoria: string
  sector: string
  rama: string
  tipoRegistro: 'condicionado' | 'incondicional'
  adscripcionesPref: AdscripcionPref[]  // máx. 3 si condicionado
}

type AdscripcionPref = {
  adscripcion: string
  turno: 'matutino' | 'vespertino' | 'nocturno' | 'jornada_acumulada'
}
```

#### `escalafon_trabajadores`

Perfil que el trabajador registra en el portal.

```typescript
{
  id: string                    // uid de Firebase Auth
  matricula: string
  nombre: string
  categoria: string
  sector: string
  rama: string
  delegacion: string
  tipoRegistro: 'condicionado' | 'incondicional'
  adscripcionesPref: AdscripcionPref[]
  esInterino: boolean
  adscripcionInterino?: string
  turnoInterino?: string
  fechaRegistro: Timestamp
  activo: boolean
}
```

#### `escalafon_registros_cambio`

Solicitudes de cambio registradas por la encargada (colas a-f del Art. 27).

```typescript
{
  id: string
  matricula: string
  nombre: string
  tipoCambio: 'turno' | 'area' | 'tipo_plaza' | 'adscripcion' | 'ampliacion_jornada' | 'residencia'
  fechaRegistro: Timestamp      // EL TIMBRE — define el orden en la cola
  horaRegistro: string          // HH:MM — parte del timbre
  percibeConcept: boolean       // percibe concepto 14, 54 o 61
  tipoPreferencia: 'condicionado' | 'incondicional'
  preferencias: AdscripcionPref[]
  categoria: string
  sector: string
  delegacionOrigen?: string     // para cambio de residencia
  delegacionDestino?: string
  activo: boolean               // false cuando se aplica o cancela
  aplicadaEnPlaza?: string      // ref a escalafon_plazas_vacantes
}
```

#### `escalafon_plazas_vacantes`

Plazas registradas por la encargada cuando se liberan.

```typescript
{
  id: string
  categoria: string
  sector: string
  rama: string
  adscripcion: string
  turno: 'matutino' | 'vespertino' | 'nocturno' | 'jornada_acumulada'
  jornada: 'completa' | 'media'
  percibeConcept: boolean       // tiene concepto 14/54/61
  tipoVacante: 'definitiva' | 'temporal'
  duracionEstimadaDias?: number // si temporal
  causal: CausalVacante
  fechaGeneracion: Timestamp    // OBLIGATORIA — define qué listado aplica
  fechaRegistro: Timestamp      // cuando la encargada la captura en el sistema
  estado: 'pendiente' | 'nominada' | 'aceptada' | 'rechazada' | 'cubierta'
  nominaciones: Nominacion[]
  listadoAplicado?: string      // ref a escalafon_listados
}

type CausalVacante =
  | 'muerte' | 'renuncia' | 'liquidacion' | 'promocion'
  | 'jubilacion' | 'invalidez' | 'sentencia' | 'rescision'
  | 'plaza_confianza' | 'licencia' | 'incapacidad' | 'beca'

type Nominacion = {
  matricula: string
  nombre: string
  posicionListado: number
  colaOrigen: 'cambio_turno_con' | 'cambio_area' | 'cambio_tipo_plaza'
             | 'cambio_turno_sin' | 'cambio_adscripcion_con'
             | 'cambio_adscripcion_sin' | 'interino' | 'promocion' | 'residencia'
  fechaNominacion: Timestamp
  fechaLimiteRespuesta: Timestamp   // +3 días hábiles
  resultado: 'pendiente' | 'aceptada' | 'rechazada'
  fechaRespuesta?: Timestamp
}
```

---

## Motor de cascada

El motor recibe una `PlazaVacante` y devuelve quién debe ser nominado.

### Pseudocódigo

```typescript
function determinarNominado(plaza: PlazaVacante): Nominado | null {
  // 1. Determinar qué listado aplica por fecha de generación
  const listado = obtenerListadoVigente(
    plaza.fechaGeneracion,
    plaza.categoria,
    plaza.sector,
  );

  // 2. Recorrer las 9 colas en orden
  const colas = [
    () => buscarCambioTurno(plaza, (conConcepto = true)), // a
    () => buscarCambioArea(plaza), // b
    () => buscarCambioTipoPlaza(plaza), // c
    () => buscarCambioTurno(plaza, (conConcepto = false)), // d
    () => buscarCambioAdscripcion(plaza, (conConcepto = true)), // e
    () => buscarCambioAdscripcion(plaza, (conConcepto = false)), // f
    () => buscarInterino(plaza), // g
    () => buscarPromocion(plaza, listado), // h  ← listado SIAF
    () => buscarCambioResidencia(plaza), // i
  ];

  for (const buscar of colas) {
    const candidato = buscar();
    if (candidato) return candidato;
  }

  return null; // sin candidato — convocar curso promocional
}
```

### Lógica de matching para promoción (cola h)

```typescript
function buscarPromocion(plaza, listado): Nominado | null {
  const candidatos = listado.trabajadores
    .filter((t) => t.categoria === categoriaInmediataInferior(plaza.categoria))
    .filter((t) => t.sector === plaza.sector)
    .filter((t) => t.rama === plaza.rama)
    .filter((t) => coincidePreferencia(t, plaza)) // condicionado vs incondicional
    .sort((a, b) => a.posicion - b.posicion); // orden del listado SIAF

  return candidatos[0] ?? null;
}

function coincidePreferencia(trabajador, plaza): boolean {
  if (trabajador.tipoRegistro === "incondicional") return true;
  return trabajador.adscripcionesPref.some(
    (p) => p.adscripcion === plaza.adscripcion && p.turno === plaza.turno,
  );
}
```

---

## Portal del trabajador

Lo que el trabajador ve en su portal:

- **Mi posición actual:** "Estás en posición #7 del listado de Enfermera General, turno matutino, Delegación BC"
- **Plazas disponibles:** "Hay 2 plazas en tu categoría pendientes de nominación"
- **Mi estado:** "Fuiste nominado el 10 de abril — tienes hasta el 14 de abril para aceptar"
- **Historial:** Registro de nominaciones anteriores y su resultado

---

## Preguntas abiertas — pendientes de validar con la encargada

Estos puntos requieren confirmación antes de iniciar implementación:

1. **¿Los registros de cambio vienen en el listado del SIAF o los lleva ella aparte?**
   Esta pregunta define si hay carga manual de datos o si todo viene del mismo PDF/Excel.

2. **¿Qué formato tiene el listado del SIAF — PDF, Excel, otro?**
   Necesario para diseñar el parser de ingesta.

3. **¿El SIAF incluye el tipo de registro (condicionado/incondicional) y las adscripciones preferidas?**
   Si no, habría que capturarlos en el registro del trabajador en el portal.

4. **¿Cuántos trabajadores hay típicamente en un listado por categoría?**
   Para estimar volumen de datos.

5. **¿Cómo le notifican al trabajador hoy? ¿Teléfono, oficio?**
   Para diseñar el flujo de notificación en el sistema (email/push).

---

## Fases de implementación propuestas

### Fase 1 — MVP funcional (encargada + listado SIAF)

- Importación del listado SIAF (PDF/Excel → Firestore)
- Captura de plazas vacantes por la encargada
- Motor de cascada simplificado: solo colas g (interinos) y h (promoción)
- Vista de la encargada: quién es el nominado y por qué
- **Validación:** la encargada usa el sistema en paralelo a su proceso manual

### Fase 2 — Portal del trabajador

- Registro del trabajador con sus preferencias
- Vista de posición en tiempo real
- Notificación de nominación y flujo de aceptación/rechazo

### Fase 3 — Colas de cambios completas (a-f)

- Módulo de registro de solicitudes de cambio
- Motor de cascada completo con las 9 colas
- Depende de confirmar con la encargada cómo tiene esos datos hoy

---

## Motor de posiciones por zona (`position-engine.ts`)

> Implementado en `src/lib/escalafon/position-engine.ts`. Validado con la encargada de escalafón BC el 2026-04-30.

### Qué calcula

Al subir un listado PDF, el motor calcula tres campos para cada aspirante:

| Campo | Descripción | Uso |
|---|---|---|
| `posicionesPorZona` | Posición global (Activos + PEI juntos) | Solo para filtros de UI (¿está en esa zona?) |
| `posicionesActivoPorZona` | Posición entre **Activos únicamente** | Promoción escalafonaria (el Activo compite vs otros Activos) |
| `posicionesPeiPorZona` | Posición entre **PEI únicamente** | Nominación a plaza definitiva (el interino compite vs otros interinos) |

**Regla de negocio validada:** Los trabajadores Activo y PEI **no compiten entre sí**. Un PEI ya tiene su interinato; su posición relevante es frente a otros PEI para convertirlo en plaza definitiva. Un Activo compite con otros Activos para promoción.

### Quién califica para una zona

Un aspirante califica para zona X si **alguna de sus preferencias** cumple:

```
esIncondicional(zonaSolicitada) === true  →  califica para TODAS las zonas
zonaSolicitada === zona                   →  califica solo para esa zona
```

### Reconocimiento de "Incondicional"

SIAP representa zona incondicional de dos formas:

| Valor en PDF | Normalizado | Reconocido como incondicional |
|---|---|---|
| `Incondicional` | `INCONDICIONAL` | ✅ |
| `0 Incondicional` | `0INCONDICIONAL` | ✅ (SIAP usa zona 0 = acepta cualquier zona) |
| `7 TIJUANA` | `7TIJUANA` | ❌ (zona específica) |

La función `esIncondicional(zona)` aplica la regla:
```typescript
const norm = zona.replace(/\s/g, "").toUpperCase();
return norm === "INCONDICIONAL" || /^\d{1,2}INCONDICIONAL$/.test(norm);
```

### Bug corregido en el parser (2026-04-30)

El regex del parser capturaba la localidad "Incondicional" como parte del nombre de zona:

- **Antes (bug):** `zonaSolicitada = "1 ENSENADA Incondicional"` → se creaban zonas duplicadas como `"7 TIJUANA"` y `"7 TIJUANA Incondicional"`
- **Después (fix):** `zonaSolicitada = "1 ENSENADA"` → el "Incondicional" de localidad no se captura en el nombre de zona

Fix: lookahead negativo en el regex de `parsearPreferenciaDesdeTexto`:
```
/^(\d{1,2}\s+[A-Z]+(?:\s+(?!Incondicional\b)[A-Z]+)?)\s+(.+)$/i
```

Se ejecutó migración `scripts/migrations/escalafon-fix-zonas.ts` para corregir datos históricos en Firestore.

### Ejemplo validado

**Listado quirúrgico — ZAZUETA ZATARAIN NOEMI (PEI, lugar 43, pide Mexicali y San Luis):**

Antes de ella en Mexicali/San Luis había 4 PEI:
1. García Arellano Francisco (lugar 10) — pide Mexicali/San Luis específicamente
2. Mendoza Vargas Alan (lugar 37) — zona `0 Incondicional`
3. Camarena Velasco Judith (lugar 39) — zona `0 Incondicional`
4. Estrada Valles Itzel (lugar 41) — zona `0 Incondicional`

→ `posicionesPeiPorZona["2 MEXICALLI"] = 5`, `posicionesPeiPorZona["4 SAN LUIS"] = 5`

---

## Estado del documento

- Fecha de creación: 2026-04-10
- Basado en: CCT IMSS-SNTSS 2025-2027 + reunión con encargada del escalafón Sección BC
- Última actualización: 2026-04-30 — motor de posiciones implementado y validado
- Estado: **Activo en producción**
