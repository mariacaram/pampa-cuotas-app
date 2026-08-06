"use client";

export default function PendingScreen({
  email,
  rechazado = false,
}: {
  email: string;
  rechazado?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200/70 bg-white p-8 text-center shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Pampa" className="mx-auto mb-6 w-40 rounded-xl object-contain shadow-sm" />
        {rechazado ? (
          <>
            <h1 className="text-lg font-bold text-neutral-900">Acceso no autorizado</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Tu cuenta <b>{email}</b> no tiene permiso para entrar. Contactá a un administrador.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-neutral-900">Tu acceso está pendiente</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Le avisamos a un administrador para que apruebe el ingreso de <b>{email}</b>. Vas a
              poder entrar apenas te aprueben.
            </p>
          </>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="btn mt-6 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}
