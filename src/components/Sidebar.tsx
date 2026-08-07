"use client";

import { motion } from "framer-motion";
import { SessionUsuario } from "@/lib/types";

export type View =
  | "tablero"
  | "pendiente"
  | "caja"
  | "productos"
  | "cuotas"
  | "novedades"
  | "usuarios"
  | "auditoria";

// Ítem "Novedades" (aviso de anulaciones). Se muestra solo a quien corresponde (ver AppRoot).
const NOVEDADES_ITEM: Item = {
  key: "novedades",
  label: "Novedades",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.5 21a1.8 1.8 0 0 1-3 0" />
    </svg>
  ),
};

// Solo estas 5 tienen atajo numérico 1-5.
export const VIEW_ORDER: View[] = ["tablero", "pendiente", "caja", "productos", "cuotas"];

type Item = { key: View; label: string; icon: React.ReactNode };

const ITEMS: Item[] = [
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
    key: "caja",
    label: "Control de caja",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 9v6M18 9v6" />
      </svg>
    ),
  },
  {
    key: "productos",
    label: "Productos estrella",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" />
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

const ADMIN_ITEMS: Item[] = [
  {
    key: "usuarios",
    label: "Usuarios y accesos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
        <path d="M17 11l2 2 3-3" />
      </svg>
    ),
  },
  {
    key: "auditoria",
    label: "Auditoría",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h12l4 4v12H4z" />
        <path d="M8 12h8M8 16h5M8 8h4" />
      </svg>
    ),
  },
];

function NavButton({
  item,
  active,
  onClick,
  numero,
  badge,
}: {
  item: Item;
  active: boolean;
  onClick: () => void;
  numero?: number;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors sm:px-3 ${
        active ? "text-emerald-800" : "text-neutral-500 hover:text-neutral-900"
      }`}
      title={item.label}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl bg-emerald-100"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <span className="relative z-10 transition-transform duration-200 group-hover:scale-110">
        {item.icon}
      </span>
      <span className="relative z-10 hidden sm:block">{item.label}</span>
      {badge && badge > 0 ? (
        <span className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
          {badge}
        </span>
      ) : numero ? (
        <span
          className={`relative z-10 ml-auto hidden h-5 w-5 items-center justify-center rounded-md text-[11px] font-semibold sm:flex ${
            active ? "bg-white/70 text-emerald-700" : "bg-neutral-100 text-neutral-400 group-hover:bg-neutral-200"
          }`}
        >
          {numero}
        </span>
      ) : null}
    </button>
  );
}

export default function Sidebar({
  view,
  onChange,
  usuario,
  pendientes = 0,
  mostrarNovedades = false,
  novedades = 0,
}: {
  view: View;
  onChange: (v: View) => void;
  usuario?: SessionUsuario;
  pendientes?: number;
  mostrarNovedades?: boolean;
  novedades?: number;
}) {
  const esAdmin = usuario?.rol === "admin";

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-16 flex-col border-r border-neutral-200/70 bg-white/80 px-2 py-6 backdrop-blur-md sm:w-60 sm:px-4">
      <motion.div
        className="mb-8 px-1 sm:px-2"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Pampa" className="w-full rounded-xl object-contain shadow-sm" />
      </motion.div>

      <nav className="space-y-1">
        {ITEMS.map((item, i) => (
          <NavButton
            key={item.key}
            item={item}
            active={view === item.key}
            onClick={() => onChange(item.key)}
            numero={i + 1}
          />
        ))}

        {mostrarNovedades && (
          <NavButton
            item={NOVEDADES_ITEM}
            active={view === "novedades"}
            onClick={() => onChange("novedades")}
            badge={novedades}
          />
        )}

        {esAdmin && (
          <>
            <div className="my-2 border-t border-neutral-100" />
            <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 sm:block">
              Administración
            </p>
            {ADMIN_ITEMS.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={view === item.key}
                onClick={() => onChange(item.key)}
                badge={item.key === "usuarios" ? pendientes : 0}
              />
            ))}
          </>
        )}
      </nav>

      {usuario ? (
        <div className="mt-auto space-y-2">
          <div className="hidden items-center gap-2 rounded-xl bg-neutral-50 p-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {(usuario.nombre || usuario.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-neutral-800">
                {usuario.nombre || usuario.email}
              </p>
              <p className="truncate text-[11px] text-neutral-400">
                {usuario.rol === "admin" ? "Administradora" : "Miembro"}
              </p>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="btn w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              Salir
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-auto hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm sm:block">
          <p className="text-sm font-semibold text-emerald-900">Control de cuotas</p>
          <p className="mt-1 text-xs text-emerald-700">
            Seguí pagos por colegio y descargá reportes para cada encargado.
          </p>
          <p className="mt-2 text-[11px] text-neutral-400">
            Atajos: teclas <b>1–5</b> para navegar · <b>/</b> para buscar
          </p>
        </div>
      )}
    </aside>
  );
}
