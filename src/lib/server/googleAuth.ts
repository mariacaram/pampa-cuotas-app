import "server-only";

// ---------------------------------------------------------------------------
// Login con Google usando OAuth 2.0 directo (sin librerías ni Supabase Auth).
// Flujo: redirigimos a Google -> Google vuelve con un "code" -> lo canjeamos
// por un id_token (JWT firmado por Google) del que sacamos email y nombre.
// ---------------------------------------------------------------------------

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleProfile = { email: string; nombre: string | null; emailVerified: boolean };

export async function exchangeCodeForProfile(
  code: string,
  redirectUri: string
): Promise<GoogleProfile | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;

  // El id_token viene directo de Google por TLS; decodificamos el payload.
  const parts = data.id_token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (!payload.email) return null;
    return {
      email: String(payload.email).toLowerCase().trim(),
      nombre: (payload.name as string) ?? null,
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
    };
  } catch {
    return null;
  }
}
