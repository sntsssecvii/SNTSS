Crea un nuevo componente siguiendo las convenciones del proyecto.

## Convenciones de nombres

- **Componentes** (`src/components/`): PascalCase → `MiComponente.tsx`
- **Componentes UI** (`src/components/ui/`): kebab-case → `mi-componente.tsx` (convencion shadcn)
- **Lib/utils** (`src/lib/`): kebab-case → `mi-utilidad.ts`
- **Types** (`src/types/`): kebab-case → `mi-tipo.ts`
- **API routes** (`src/app/api/`): kebab-case directorios → `mi-endpoint/route.ts`
- **Pages** (`src/app/`): kebab-case directorios → `mi-pagina/page.tsx`

## Instrucciones

1. Determina donde va el archivo segun su tipo.
2. Usa la convencion de nombre correcta para ese directorio.
3. Si es un componente React:
   - Usa export default para page.tsx y layout.tsx
   - Usa named exports para componentes reutilizables
   - Agrega 'use client' solo si usa hooks, eventos o browser APIs
4. Si es un componente UI base, sigue el patron de shadcn en `src/components/ui/`.
5. Si necesita tipos, definirlos en el mismo archivo o en `src/types/` si son compartidos.
