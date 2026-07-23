import * as XLSX from "xlsx";
import { ParsedSheet } from "./types";

export async function parseWorkbook(
  file: File
): Promise<{ sheetNames: string[]; sheets: Record<string, ParsedSheet> }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheets: Record<string, ParsedSheet> = {};
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    sheets[name] = buildParsedSheet(raw);
  }

  return { sheetNames: workbook.SheetNames, sheets };
}

function buildParsedSheet(raw: unknown[][]): ParsedSheet {
  const headerRowIndex = guessHeaderRow(raw);
  const headerRow = (raw[headerRowIndex] || []) as unknown[];
  const headers = headerRow.map((h, i) =>
    String(h ?? "").trim() || `Columna ${i + 1}`
  );

  const rows: Record<string, unknown>[] = [];
  for (let r = headerRowIndex + 1; r < raw.length; r++) {
    const rowArr = raw[r] as unknown[];
    if (!rowArr || rowArr.every((c) => c === "" || c == null)) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = rowArr[i] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows, headerRowIndex };
}

function guessHeaderRow(raw: unknown[][]): number {
  const limit = Math.min(raw.length, 20);
  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < limit; i++) {
    const row = raw[i] as unknown[];
    if (!row) continue;
    const nonEmpty = row.filter((c) => c !== "" && c != null).length;
    if (nonEmpty > bestScore) {
      bestScore = nonEmpty;
      bestIndex = i;
    }
  }
  return bestIndex;
}

const GUESS_KEYWORDS: Record<string, string[]> = {
  colegio: ["colegio", "escuela", "institucion", "institución"],
  alumno: ["alumno", "nombre", "estudiante"],
  precioTotal: ["precio total", "precio", "importe total", "total"],
  pagado: ["pagado", "señado", "senado", "abonado"],
  cuotasPactadas: ["cuotas", "n° cuotas", "cantidad de cuotas"],
};

export function guessColumn(headers: string[], field: keyof typeof GUESS_KEYWORDS): string | null {
  const keywords = GUESS_KEYWORDS[field];
  const normalized = headers.map((h) => h.toLocaleLowerCase("es"));
  for (const kw of keywords) {
    const idx = normalized.findIndex((h) => h.includes(kw));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
