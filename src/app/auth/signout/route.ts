import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/session";

export async function POST(req: Request) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
