"use client";

import { useMemo, useState } from "react";
import { parseWorkbook, guessColumn, toNumber } from "@/lib/excelParser";
import { standardizeName } from "@/lib/nameUtils";
import { buildSampleDataset } from "@/lib/sampleData";
import { Dataset, ParsedSheet } from "@/lib/types";

type Props = {
  onDatasetReady: (dataset: Dataset) => void;
};

const FIELD_LABELS: { key: "colegio" | "alumno" | "precioTotal" | "pagado" | "cuotasPactadas"; label: string; optional?: boolean }[] = [
  { key: "colegio", label: "Colegio" },
  { key: "alumno", label: "Alumno" },
  { key: "precioTotal", label: "Precio total" },
  { key: "pagado", label: "Pagado / señado" },
  { key: "cuotasPactadas", label: "Cuotas pactadas", optional: true },
];

export default function UploadPanel({ onDatasetReady }: Props) {
  const [sheets, setSheets] = useState<Record<string, ParsedSheet> | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [cuotasDefault, setCuotasDefault] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const currentSheet = selectedSheet && sheets ? sheets[selectedSheet] : null;

  const headers = currentSheet?.headers ?? [];

  async function handleFile(file: File) {
    setError(null);
    try {
      const parsed = await parseWorkbook(file);
      setSheets(parsed.sheets);
      setSheetNames(parsed.sheetNames);
      const first = parsed.sheetNames[0];
      setSelectedSheet(first);
      autoGuess(parsed.sheets[first].headers);
    } catch {
      setError("No se pudo leer el archivo. Verificá que sea un .xlsx o .xls válido.");
    }
  }

  function autoGuess(hdrs: string[]) {
    setMapping({
      colegio: guessColumn(hdrs, "colegio") ?? "",
      alumno: guessColumn(hdrs, "alumno") ?? "",
      precioTotal: guessColumn(hdrs, "precioTotal") ?? "",
      pagado: guessColumn(hdrs, "pagado") ?? "",
      cuotasPactadas: guessColumn(hdrs, "cuotasPactadas") ?? "",
    });
  }

  function handleSheetChange(name: string) {
    setSelectedSheet(name);
    if (sheets) autoGuess(sheets[name].headers);
  }

  const previewRows = useMemo(() => currentSheet?.rows.slice(0, 5) ?? [], [currentSheet]);

  const canImport = mapping.colegio && mapping.alumno && mapping.precioTotal && mapping.pagado;

  function handleImport() {
    if (!currentSheet || !canImport) return;
    const alumnos = currentSheet.rows
      .filter((row) => String(row[mapping.alumno] ?? "").trim() !== "")
      .map((row, i) => {
        const nombreOriginal = String(row[mapping.alumno] ?? "").trim();
        return {
          id: `import-${i + 1}`,
          colegio: String(row[mapping.colegio] ?? "").trim() || "Sin colegio",
          nombreOriginal,
          nombreEstandarizado: standardizeName(nombreOriginal),
          precioTotal: toNumber(row[mapping.precioTotal]),
          pagado: toNumber(row[mapping.pagado]),
          cuotasPactadas: mapping.cuotasPactadas
            ? toNumber(row[mapping.cuotasPactadas]) || cuotasDefault
            : cuotasDefault,
          atrasado: false,
          interes: 0,
        };
      });

    onDatasetReady({
      nombre: selectedSheet,
      creadoEn: new Date().toISOString(),
      alumnos,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center">
        <p className="mb-3 text-sm text-neutral-600">
          Subí el Excel del colegio (cualquier formato de columnas)
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="mx-auto block text-sm"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4">
          <button
            onClick={() => onDatasetReady(buildSampleDataset())}
            className="text-sm text-blue-600 underline underline-offset-2"
          >
            o probar con datos de ejemplo
          </button>
        </div>
      </div>

      {sheets && (
        <div className="space-y-4 rounded-xl border border-neutral-200 p-5">
          {sheetNames.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-neutral-700">Hoja</label>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              >
                {sheetNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Indicá qué columna corresponde a cada dato
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELD_LABELS.map(({ key, label, optional }) => (
                <div key={key}>
                  <label className="block text-xs text-neutral-500">
                    {label} {optional && "(opcional)"}
                  </label>
                  <select
                    value={mapping[key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
                  >
                    <option value="">-- sin mapear --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!mapping.cuotasPactadas && (
              <div className="mt-3">
                <label className="block text-xs text-neutral-500">
                  Cantidad de cuotas por defecto (si el Excel no la indica)
                </label>
                <input
                  type="number"
                  min={1}
                  value={cuotasDefault}
                  onChange={(e) => setCuotasDefault(Number(e.target.value) || 1)}
                  className="mt-1 w-32 rounded-md border border-neutral-300 p-2 text-sm"
                />
              </div>
            )}
          </div>

          {previewRows.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-1 text-xs text-neutral-500">Vista previa (primeras filas)</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-50">
                    {headers.map((h) => (
                      <th key={h} className="border p-1 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i}>
                      {headers.map((h) => (
                        <td key={h} className="border p-1">
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!canImport}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Confirmar e importar
          </button>
          {!canImport && (
            <p className="text-xs text-amber-600">
              Mapeá al menos Colegio, Alumno, Precio total y Pagado para continuar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
