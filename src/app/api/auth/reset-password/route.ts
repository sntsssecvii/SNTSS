import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { sendPasswordResetEmail } from "@/lib/email";
import { enforceRateLimitRedis } from "@/lib/security/rate-limit-redis";
import { RateLimitError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let email = "";

  try {
    const body = await request.json().catch(() => ({}));
    email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    // Rate limit por email (3 intentos / hora)
    if (email) {
      await enforceRateLimitRedis(request, {
        bucket: "api:auth:reset:email",
        limit: 3,
        windowMs: 60 * 60_000,
        identifier: email,
      });
    }

    // Anti-enumeration: procesamos en background y siempre respondemos 200
    if (email && email.includes("@")) {
      setImmediate(async () => {
        try {
          const resetLink = await adminAuth.generatePasswordResetLink(email, {
            url: `${process.env.NEXT_PUBLIC_APP_URL || "https://sntssvii.com"}/login`,
          });

          const userRecord = await adminAuth.getUserByEmail(email);
          const userDoc = await adminDb
            .collection("users")
            .doc(userRecord.uid)
            .get();
          const nombre = userDoc.exists
            ? userDoc.data()?.nombre || "Usuario"
            : "Usuario";

          await sendPasswordResetEmail(email, nombre, resetLink);
        } catch (err) {
          // No exponer — anti-enumeration
          console.error("[reset-password] Error generando/enviando link:", err);
        }
      });
    }

    // Siempre 200 — no confirmamos si el email existe
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof RateLimitError || error?.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 60) },
        },
      );
    }

    // Cualquier otro error → 200 (anti-enumeration)
    return NextResponse.json({ success: true });
  }
}
