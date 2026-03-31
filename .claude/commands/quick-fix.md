Aplica un fix rapido con validacion automatica.

## Instrucciones

1. Implementa el fix descrito por el usuario.
2. Inmediatamente despues, corre `npm run typecheck` y `npm run lint`.
3. Si el fix toca parsing: corre `npm run pdf:test`.
4. Si el fix toca posiciones: corre `npm run positions:test`.
5. Si todo pasa, haz un commit con formato `fix: <descripcion concisa>`.
6. Si algo falla, corrige y repite hasta que pase.
