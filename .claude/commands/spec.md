Inicia un flujo de specification-driven development (SDD) para una feature o cambio importante.

## Instrucciones

1. Pregunta al usuario que quiere construir si no lo ha descrito ya.
2. Elige la plantilla mas adecuada de `docs/specs/templates/`:
   - `feature-spec.md` — funcionalidad nueva o cambio de comportamiento
   - `security-spec.md` — hardening, reglas de acceso, auth
   - `ui-spec.md` — rediseno o cambio visual significativo
3. Crea el spec en `docs/specs/<nombre-descriptivo>.md` usando la plantilla como base.
4. Llena las secciones con la informacion del usuario: objetivo, alcance, reglas de negocio, riesgos, criterios de aceptacion.
5. Deriva un backlog tecnico en `docs/specs/<nombre-descriptivo>-backlog.md` con tareas ordenadas por prioridad y dependencia.
6. Presenta el spec y backlog al usuario para revision antes de implementar.

## Reglas

- No saltar a implementacion si las reglas de negocio son ambiguas.
- Criterios de aceptacion deben ser verificables, no vagos.
- Mantener specs cortos y ejecutables, no documentos largos.
