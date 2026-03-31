Crea un nuevo API route siguiendo las convenciones del proyecto.

## Estructura obligatoria

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/firebase/server-auth";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAdminRequest(request);
    // logica
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: "mensaje" }, { status: 500 });
  }
}
```

## Instrucciones

1. Crea el directorio en `src/app/api/` con kebab-case.
2. El archivo siempre se llama `route.ts`.
3. Incluye autenticacion con `requireAdminRequest()` para rutas admin o validacion de auth para rutas de trabajador.
4. Valida input con Zod si recibe body.
5. Usa funciones de `src/lib/firebase/` para operaciones de datos — no acceder a Firestore directamente en el route.
6. Agrega rate limiting si es un endpoint publico o sensible.
7. Agrega audit log con `logAdminAction()` si es una operacion de escritura admin.
8. Corre `npm run typecheck` despues de crear.
