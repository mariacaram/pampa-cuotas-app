"use client";

import { useEffect, useState } from "react";

export default function LoginScreen() {
  const [error, setError] = useState(false);

  useEffect(() => {
    // Si volvimos de Google con un error, lo mostramos.
    const p = new URLSearchParams(window.location.search);
    if (p.get("auth_error")) setError(true);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200/70 bg-white p-8 text-center shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Pampa" className="mx-auto mb-6 w-40 rounded-xl object-contain shadow-sm" />
        <h1 className="text-lg font-bold text-neutral-900">Control de cuotas</h1>
        <p className="mt-1 text-sm text-neutral-500">Ingresá con tu cuenta de Google para continuar.</p>

        <a
          href="/api/auth/google/start"
          className="btn mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Ingresar con Google
        </a>

        {error && (
          <p className="mt-3 text-sm text-red-600">
            No se pudo iniciar sesión. Probá de nuevo.
          </p>
        )}
        <p className="mt-6 text-xs text-neutral-400">
          Si tu cuenta no tiene acceso, se le pedirá aprobación a una administradora.
        </p>
      </div>
    </div>
  );
}
