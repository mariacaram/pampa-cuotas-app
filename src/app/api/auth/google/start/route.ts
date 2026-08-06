import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { googleAuthUrl } from "@/lib/server/googleAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const redirectUri = new URL("/api/auth/google/callback", req.nextUrl.origin).toString();
  const state = randomBytes(16).toString("hex");

  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  // Guardamos el state para verificarlo en el callback (CSRF).
  res.cookies.set("pampa_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
