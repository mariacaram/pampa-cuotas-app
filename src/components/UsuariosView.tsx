"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { Card } from "./ui";

type Usuario = {
  email: string;
  nombre: string | null;
  rol: "admin" | "miembro";
  estado: "pendiente" | "aprobado" | "rechazado";
  creado_en: string;
  ultimo_ingreso: string | null;
  aprobado_por: string | null;
};

const ESTADO: Record<string, string> = {
  aprobado: "bg-emerald-100 text-emerald-800",
  pendiente: "bg-amber-100 text-amber-800",
  rechazado: "bg-red-100 text-red-700",
};

export default function UsuariosView({ onChange }: { onChange?: () => void }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function cargar() {
    try {
      const res = await fetch("/api/admin/usuarios");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      setUsuarios(d.usuarios);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accion(email: string, accion: "aprobar" | "rechazar") {
    setSaving(email);
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, accion }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      setUsuarios(d.usuarios);
      onChange?.();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(null);
    }
  }

  const pendientes = usuarios.filter((u) => u.estado === "pendiente");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Usuarios y accesos</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Aprobá o rechazá quién puede entrar a la app.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : (
        <>
          {pendientes.length > 0 && (
            <Card>
              <p className="mb-3 font-semibold text-neutral-800">
                Solicitudes pendientes ({pendientes.length})
              </p>
              <div className="space-y-2">
                {pendientes.map((u) => (
                  <div
                    key={u.email}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50/60 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{u.nombre || u.email}</p>
                      <p className="text-xs text-neutral-500">{u.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => accion(u.email, "aprobar")}
                        disabled={saving === u.email}
                        className="btn btn-primary rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => accion(u.email, "rechazar")}
                        disabled={saving === u.email}
                        className="btn rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-0">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className="text-sm font-semibold text-neutral-800">Todos los usuarios ({usuarios.length})</p>
            </div>
            <div className="thin-scroll max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
                  <tr>
                    <th className="p-3">Usuario</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Último ingreso</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.email} className="border-t border-neutral-100">
                      <td className="p-3">
                        <div className="font-medium">{u.nombre || "—"}</div>
                        <div className="text-xs text-neutral-500">{u.email}</div>
                      </td>
                      <td className="p-3">{u.rol}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO[u.estado]}`}>
                          {u.estado}
                        </span>
                      </td>
                      <td className="p-3 text-neutral-500">
                        {u.ultimo_ingreso ? formatDate(u.ultimo_ingreso) : "—"}
                      </td>
                      <td className="p-3">
                        {u.rol !== "admin" && (
                          <div className="flex gap-2">
                            {u.estado !== "aprobado" && (
                              <button
                                onClick={() => accion(u.email, "aprobar")}
                                disabled={saving === u.email}
                                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                Aprobar
                              </button>
                            )}
                            {u.estado !== "rechazado" && (
                              <button
                                onClick={() => accion(u.email, "rechazar")}
                                disabled={saving === u.email}
                                className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                              >
                                Rechazar
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
