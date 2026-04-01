# Firestore Schema Map

Documento de referencia para todas las colecciones de Firestore en SNTSS.
Actualizar este documento cuando se agreguen campos o colecciones nuevas.

## Colecciones

### `users/{userId}`

| Campo                    | Tipo      | Requerido | Descripcion                                             |
| ------------------------ | --------- | --------- | ------------------------------------------------------- |
| email                    | string    | si        | Email del usuario                                       |
| nombre                   | string    | si        | Nombre                                                  |
| apellidoPaterno          | string    | si        | Apellido paterno                                        |
| apellidoMaterno          | string    | si        | Apellido materno                                        |
| role                     | enum      | si        | SUPER_ADMIN, ADMIN, REVISOR, CAPTURISTA, CONSULTA, USER |
| status                   | enum      | si        | pending, active, rejected                               |
| matricula                | string    | si        | Numero de matricula                                     |
| curp                     | string    | no        | CURP                                                    |
| createdAt                | Timestamp | si        | Fecha de creacion                                       |
| updatedAt                | Timestamp | no        | Ultima actualizacion                                    |
| rejectionReason          | string    | no        | Razon de rechazo                                        |
| documents.identificacion | string    | no        | URL de identificacion                                   |
| documents.tarjeton       | string    | no        | URL de tarjeton                                         |

**Acceso:** Usuario propio + admin. No puede auto-actualizar role/status.
**Archivos:** `src/lib/firebase/users.ts`, `src/app/api/admin/validaciones/`

---

### `sincronizaciones/{syncId}`

| Campo             | Tipo      | Requerido | Descripcion                             |
| ----------------- | --------- | --------- | --------------------------------------- |
| anio              | number    | si        | Ano del periodo                         |
| mes               | number    | si        | Mes (1-12)                              |
| quincena          | 1 \| 2    | si        | Primera o segunda quincena              |
| estado            | enum      | si        | BORRADOR, PROCESANDO, COMPLETADO, ERROR |
| fechaInicio       | Timestamp | si        | Inicio del proceso                      |
| fechaFinalizacion | Timestamp | no        | Fin del proceso                         |
| archivosSubidos   | string[]  | si        | IDs de documentos subidos               |
| esFuenteVerdad    | boolean   | si        | Marca la version oficial del periodo    |
| subidoPor         | string    | si        | UID del usuario                         |
| subidoPorEmail    | string    | no        | Email del usuario                       |

**Acceso:** Solo admin.
**Indices:** `esFuenteVerdad` + limit(1), `anio` + `mes` + `quincena`
**Archivos:** `src/lib/firebase/sincronizaciones.ts`

---

### `bolsa_de_trabajo_documentos/{documentoId}`

| Campo                   | Tipo         | Requerido | Descripcion                                     |
| ----------------------- | ------------ | --------- | ----------------------------------------------- |
| syncId                  | string       | si        | Referencia a sincronizacion                     |
| tipo                    | enum         | si        | NUEVO_INGRESO, CAMBIOS_AREA, CAMBIOS_RAMA, etc. |
| estado                  | enum         | si        | PROCESANDO, COMPLETADO, ERROR, VALIDANDO        |
| fechaCarga              | Timestamp    | si        | Fecha de carga                                  |
| fechaActualizacion      | Timestamp    | si        | Fecha del documento original                    |
| subidoPor               | string       | si        | UID del usuario                                 |
| urlArchivo              | string       | si        | URL en Firebase Storage                         |
| nombreArchivo           | string       | no        | Nombre del archivo                              |
| totalRegistros          | number       | no        | Total de registros extraidos                    |
| registrosValidados      | number       | no        | Registros validados                             |
| registrosConErrores     | number       | no        | Registros con errores                           |
| metadata.zona           | string       | no        | Zona geografica                                 |
| metadata.categoria      | string       | no        | Categoria                                       |
| metadata.totalRegistros | number       | no        | Total registros en metadata                     |
| metadata.extraidoCon    | PDF \| EXCEL | no        | Metodo de extraccion                            |
| errores                 | string[]     | no        | Lista de errores                                |
| version                 | number       | si        | Version del documento                           |

**Subcoleccion:** `registros/{registroId}` — registros individuales extraidos del PDF/Excel.
**Acceso:** Solo admin.
**Archivos:** `src/lib/firebase/bolsa-de-trabajo.ts`

---

### `bolsa_de_trabajo_documentos/{docId}/registros/{registroId}`

| Campo              | Tipo    | Requerido | Descripcion              |
| ------------------ | ------- | --------- | ------------------------ |
| tipoDocumento      | enum    | si        | Tipo de bolsa            |
| syncId             | string  | no        | Referencia a sync        |
| nombre             | string  | no        | Nombre del trabajador    |
| matricula          | string  | no        | Matricula                |
| categoria          | string  | no        | Categoria                |
| zona               | string  | no        | Zona                     |
| adscripcion        | string  | no        | Adscripcion actual       |
| clave              | string  | no        | Clave de adscripcion     |
| confianza          | number  | no        | Score de confianza (0-1) |
| filaOriginal       | number  | no        | Fila en documento fuente |
| necesitaValidacion | boolean | no        | Requiere revision manual |
| validado           | boolean | no        | Ya fue validado          |

Campos adicionales varian segun `tipoDocumento` (turno, jornada, residencia, rama, etc.)

---

### `bolsa_posiciones_materializadas/{lookupId}`

**ID Format:** `{syncId}__{matricula}__{tipoDocumento}__{recordId}`

| Campo                | Tipo      | Requerido | Descripcion                        |
| -------------------- | --------- | --------- | ---------------------------------- |
| syncId               | string    | si        | Referencia a sync                  |
| matricula            | string    | si        | Matricula (normalizada mayusculas) |
| tipoDocumento        | enum      | si        | Tipo de bolsa                      |
| documentoId          | string    | si        | Referencia a documento fuente      |
| periodo.anio         | number    | si        | Ano                                |
| periodo.mes          | number    | si        | Mes                                |
| periodo.quincena     | 1 \| 2    | si        | Quincena                           |
| posicionBase         | number    | si        | Posicion en ranking                |
| totalEnCategoria     | number    | si        | Total en la categoria              |
| nombre               | string    | si        | Nombre del trabajador              |
| categoria            | string    | si        | Categoria                          |
| zona                 | string    | si        | Zona                               |
| versionCalculo       | string    | si        | Version del algoritmo              |
| fechaMaterializacion | Timestamp | si        | Fecha de calculo                   |
| posicionInterinato   | number    | no        | Posicion para interinato           |
| tipoContratacion     | string    | no        | Tipo de contratacion               |
| grupoComparable      | Record    | no        | Metricas de comparacion            |
| reglasAplicadas      | string[]  | no        | Reglas que se aplicaron            |
| explicacion          | string    | no        | Explicacion del calculo            |

**Acceso:** Solo admin (escritura), trabajador autenticado (lectura propia).
**Indices:** `syncId` + `matricula`
**Archivos:** `src/lib/firebase/bolsa-posiciones-materializadas.ts`

---

### `propuestas/{propuestaId}`

| Campo              | Tipo      | Requerido | Descripcion                                                          |
| ------------------ | --------- | --------- | -------------------------------------------------------------------- |
| trabajadorActivo   | object    | si        | Datos del trabajador activo                                          |
| aspirante          | object    | si        | Datos del aspirante                                                  |
| estado             | enum      | si        | BORRADOR, EN_REVISION, APROBADA, RECHAZADA, ENVIADA_IMSS, COMPLETADA |
| fechaCreacion      | Timestamp | si        | Fecha de creacion                                                    |
| fechaActualizacion | Timestamp | si        | Ultima actualizacion                                                 |
| creadoPor          | string    | si        | UID del creador                                                      |
| historial          | array     | si        | Historial de cambios de estado                                       |
| comentarios        | array     | no        | Comentarios del equipo                                               |
| prioridad          | enum      | si        | ALTA, MEDIA, BAJA                                                    |
| etiquetas          | string[]  | no        | Tags                                                                 |

**Acceso:** Admin (CRUD completo).
**Archivos:** `src/lib/firebase/propuestas.ts`

---

### `notifications/{notificationId}`

| Campo     | Tipo      | Requerido | Descripcion                                            |
| --------- | --------- | --------- | ------------------------------------------------------ |
| userId    | string    | si        | UID del destinatario                                   |
| title     | string    | si        | Titulo                                                 |
| message   | string    | si        | Contenido                                              |
| type      | enum      | si        | system, registration, proposal, success, warning, info |
| read      | boolean   | si        | Leida o no                                             |
| createdAt | Timestamp | si        | Fecha de creacion                                      |
| link      | string    | no        | Link de navegacion                                     |

**Acceso:** Usuario propio + admin.
**Archivos:** `src/lib/firebase/notifications.ts`

---

### `admin_audit_logs/{logId}`

| Campo      | Tipo      | Requerido | Descripcion              |
| ---------- | --------- | --------- | ------------------------ |
| action     | string    | si        | Accion realizada         |
| actorUid   | string    | si        | UID del admin            |
| actorEmail | string    | no        | Email del admin          |
| targetType | string    | si        | Tipo de recurso afectado |
| targetId   | string    | no        | ID del recurso           |
| status     | enum      | si        | SUCCESS, ERROR           |
| ip         | string    | no        | IP del request           |
| metadata   | Record    | no        | Contexto adicional       |
| createdAt  | Timestamp | si        | Fecha                    |

**Acceso:** Solo admin (append-only en practica).
**Archivos:** `src/lib/firebase/admin-audit.ts`

---

## Colecciones en Firestore Rules (sin operaciones en codigo actual)

- `tramites/{tramiteId}` — Solo admin
- `correspondencia-enviada/{corrId}` — Solo admin
- `afiliacion/{afilId}` — Solo admin
- `cambios-consultorio/{cambioId}` — Solo admin
- `contadores/{contadorId}` — Solo admin (contadores de folios oficiales)

## Convenciones

- Los IDs de documento se generan automaticamente excepto `bolsa_posiciones_materializadas` que usa ID compuesto
- Timestamps siempre con `serverTimestamp()` en escrituras
- Matriculas se normalizan a mayusculas antes de queries
- `esFuenteVerdad` es un flag singleton por periodo — solo una sincronizacion puede ser fuente de verdad
