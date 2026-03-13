# Estado actual: Landing y flujo de acceso

## Objetivo de este documento

Dejar registro del estado actual del rediseño de la portada pública y de las pantallas de acceso para poder continuar sin perder contexto.

## Estado del código al momento de esta nota

Archivos relevantes detectados:

- `src/app/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/registro/page.tsx`

Estado observado:

- `src/app/page.tsx` ya funciona como nueva portada pública del sitio.
- `src/app/(auth)/login/page.tsx` fue rediseñada con una dirección visual más fuerte y más cuidada.
- `src/app/(auth)/registro/page.tsx` también fue rediseñada para mantener continuidad visual con login y portada.

## Qué ya cambió

### 1. Home pública

La raíz del sitio dejó de ser una simple redirección a `login` y pasó a plantearse como una portada institucional.

Características visibles en código:

- navbar flotante con CTA principal
- hero visual fuerte
- secciones de servicios
- narrativa más extensa
- CTA final
- footer más trabajado

Observación:

- la estructura visual ya apunta a una landing de alto impacto
- después de una pasada editorial adicional, el tono quedó mucho más cerca de servicio sindical y menos de pitch de producto

### 2. Login

El login ya no se siente como pantalla administrativa básica.

Dirección actual:

- split layout premium
- lado izquierdo narrativo con branding y motion
- lado derecho más limpio y enfocado al acceso
- estética moderna, oscura y con acentos rojos

Fortalezas:

- se percibe más valioso
- mejor presencia institucional
- mejor primera impresión que la versión previa

Riesgos:

- todavía conviene seguir afinando el tono si aparece copy nuevo en futuras iteraciones
- cualquier cambio adicional debe respetar la dirección ya acordada: servicio institucional para trabajadores, no discurso de producto

### 3. Registro

La pantalla de registro ya está alineada con el login y con una propuesta visual mucho más cuidada.

Dirección actual:

- header más editorial
- hero corto con foco en incorporación
- contenedor del formulario más premium
- footer más elaborado

Fortalezas:

- continuidad visual con login
- sensación de producto más serio
- mejor presentación para una demo o revisión

Riesgos:

- si crece más la página, hay que cuidar que no vuelva a subir el tono promocional
- el registro debe mantenerse claro, directo y orientado al trabajador

## Lectura general

El salto visual sí existe y va en la dirección correcta:

- más moderno
- más intencional
- más memorable

Pero todavía hay una tensión entre dos tonos:

- tono de producto/landing
- tono de servicio sindical al trabajador

La parte visual ya está mucho más cerca del objetivo. Después de la última pasada editorial, el tono quedó bastante mejor resuelto. El trabajo pendiente más fino está en:

- jerarquía de mensajes
- qué se promete desde portada y acceso
- futuras expansiones sin perder el tono ya alcanzado

## Criterios recomendados para la siguiente iteración

### Mantener

- nivel visual alcanzado
- riqueza de layout
- navbar y footer más presentes
- sensación premium en login/registro

### Ajustar

- mantener lenguaje de servicio, consulta, apoyo, acceso e información oficial
- evitar que futuras secciones regresen a términos como “ecosistema”, “transformación” o pitch de producto
- seguir hablándole al trabajador y no al equipo interno

### Confirmar

- si la portada pública será informativa o si también mostrará datos vivos
- si las secciones `Servicios`, `Avisos` y similares tendrán destino real inmediato
- si el tono deseado final es:
  - institucional sobrio
  - institucional cercano
  - o institucional aspiracional

## Recomendación práctica

Antes de seguir con nuevas pantallas públicas:

1. cerrar tono final de copy para home/login/registro
2. consolidar `src/app/page.tsx` en Git
3. decidir si la portada pública enlazará a módulos reales o sólo a login/registro

## Siguiente paso recomendado

Con el tono y la dirección visual ya mucho más definidos, el siguiente paso recomendado es:

1. consolidar este bloque en Git
2. decidir qué secciones de la portada tendrán destinos reales inmediatos
3. continuar con módulos funcionales sin perder la línea editorial alcanzada
