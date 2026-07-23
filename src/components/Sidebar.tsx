"use client";

export type View = "tablero" | "pendiente" | "cuotas";

const ITEMS: { key: View; label: string; icon: React.ReactNode }[] = [
  {
    key: "tablero",
    label: "Tablero de datos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    key: "pendiente",
    label: "Pendiente de cobro",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    key: "cuotas",
    label: "Cuotas y pagos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </svg>
    ),
  },
];

export default function Sidebar({
  view,
  onChange,
}: {
  view: View;
  onChange: (v: View) => void;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-16 flex-col border-r border-neutral-200/70 bg-white px-2 py-6 sm:w-60 sm:px-4">
      <div className="mb-8 px-1 sm:px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="Pampa"
          className="hidden h-16 w-full rounded-xl object-cover sm:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="Pampa"
          className="mx-auto block h-10 w-10 rounded-lg object-cover sm:hidden"
        />
      </div>

      <nav className="space-y-1">
        {ITEMS.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors sm:px-3 ${
                active
                  ? "bg-emerald-100 text-emerald-800"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
              }`}
              title={item.label}
            >
              {item.icon}
              <span className="hidden sm:block">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto hidden rounded-2xl bg-emerald-50 p-4 sm:block">
        <p className="text-sm font-semibold text-emerald-900">Control de cuotas</p>
        <p className="mt-1 text-xs text-emerald-700">
          Seguí pagos por colegio y descargá reportes para cada encargado.
        </p>
      </div>
    </aside>
  );
}
