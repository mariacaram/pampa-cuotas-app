import "server-only";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { getProyeccionDetalle, ProyeccionFila, CobranzaModo } from "./stats";

function modoLabel(modo: CobranzaModo): string {
  if (modo === "atrasado") return "Solo atrasado (vencido)";
  if (modo === "esteMes") return "A cobrar este mes";
  return "Todo lo pendiente";
}

function money(n: number): string {
  return "$ " + Math.round(n || 0).toLocaleString("es-AR");
}

// "2026-08" -> "Agosto 2026"; "Vencido" queda igual.
function grupoLabel(grupoKey: string): string {
  if (grupoKey === "0000-00") return "Vencido (ya debería estar cobrado)";
  const [y, m] = grupoKey.split("-").map(Number);
  if (!y || !m) return grupoKey;
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ddmmyyyy(iso: string): string {
  return iso ? iso.split("-").reverse().join("/") : "";
}

// Orden: vencido primero, luego meses ascendentes; dentro, por colegio y alumno.
function ordenar(filas: ProyeccionFila[]): ProyeccionFila[] {
  return [...filas].sort(
    (a, b) =>
      a.grupoKey.localeCompare(b.grupoKey) ||
      a.colegio.localeCompare(b.colegio, "es") ||
      a.alumno.localeCompare(b.alumno, "es")
  );
}

// ------------------------------ EXCEL ------------------------------
export async function buildProyeccionXlsx(
  organizacion?: string,
  modo: CobranzaModo = "todos"
): Promise<Buffer> {
  const { proyeccion, filas } = await getProyeccionDetalle(organizacion, modo);

  // Hoja Resumen
  const resumen: (string | number)[][] = [
    ["Saldo pendiente por mes", proyeccion.scope],
    ["Filtro", modoLabel(modo)],
    ["Fecha", new Date().toISOString().slice(0, 10)],
    [],
    ["Grupo", "Monto", "Cuotas"],
    ["Vencido (ya debería estar cobrado)", Math.round(proyeccion.vencido.monto), proyeccion.vencido.cuotas],
  ];
  for (const m of proyeccion.meses) {
    resumen.push([grupoLabel(m.mes), Math.round(m.monto), m.cuotas]);
  }
  resumen.push([], ["Total pendiente", Math.round(proyeccion.total)]);
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  wsResumen["!cols"] = [{ wch: 38 }, { wch: 18 }, { wch: 10 }];

  // Hoja Detalle (una fila por cuota, con el cliente)
  const detalle: (string | number)[][] = [
    ["Mes / Grupo", "Colegio", "Alumno", "Cuota N°", "Vencimiento", "Monto"],
  ];
  for (const f of ordenar(filas)) {
    detalle.push([
      grupoLabel(f.grupoKey),
      f.colegio,
      f.alumno,
      f.cuota || "",
      ddmmyyyy(f.vencimiento),
      Math.round(f.monto),
    ]);
  }
  const wsDetalle = XLSX.utils.aoa_to_sheet(detalle);
  wsDetalle["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 30 }, { wch: 9 }, { wch: 13 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle por cliente");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ------------------------------ PDF ------------------------------
const BLUE = rgb(0.188, 0.447, 0.706);
const BLUE_DARK = rgb(0.153, 0.365, 0.584);
const RED = rgb(0.86, 0.15, 0.15);
const TEXT = rgb(0.09, 0.14, 0.18);
const MUTED = rgb(0.42, 0.49, 0.55);
const ROW_ALT = rgb(0.945, 0.965, 0.985);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Ctx = { pdf: PDFDocument; font: PDFFont; bold: PDFFont; page: PDFPage; y: number };

function truncate(font: PDFFont, text: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
  return t + "…";
}
function safe(s: string): string {
  return (s ?? "").replace(/[^\x00-\xff]/g, (ch) => (ch === "–" ? "-" : ch === "…" ? "..." : "?"));
}
function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

export async function buildProyeccionPdf(
  organizacion?: string,
  modo: CobranzaModo = "todos"
): Promise<Buffer> {
  const { proyeccion, filas } = await getProyeccionDetalle(organizacion, modo);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pdf, font, bold, page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN };

  const headH = 54;
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - headH, width: PAGE_W, height: headH, color: BLUE });
  ctx.page.drawText("Saldo pendiente por mes", { x: MARGIN, y: PAGE_H - 34, size: 18, font: bold, color: WHITE });
  ctx.page.drawText(safe(proyeccion.scope + "  ·  " + modoLabel(modo) + "  ·  " + new Date().toISOString().slice(0, 10)), {
    x: MARGIN, y: PAGE_H - 48, size: 9, font, color: rgb(0.85, 0.92, 0.99),
  });
  ctx.y = PAGE_H - headH - 20;

  // Resumen por grupo
  ctx.page.drawText(safe("Total pendiente: " + money(proyeccion.total)), {
    x: MARGIN, y: ctx.y, size: 11, font: bold, color: TEXT,
  });
  ctx.y -= 16;
  const resumenLines = [
    "Vencido: " + money(proyeccion.vencido.monto) + "  (" + proyeccion.vencido.cuotas + " cuotas)",
    ...proyeccion.meses.map((m) => grupoLabel(m.mes) + ": " + money(m.monto) + "  (" + m.cuotas + " cuotas)"),
  ];
  for (const l of resumenLines) {
    ctx.page.drawText(safe(l), { x: MARGIN, y: ctx.y, size: 8.5, font, color: MUTED });
    ctx.y -= 12;
  }
  ctx.y -= 8;

  // Tabla de detalle por cliente
  const cols = [
    { title: "Mes", w: 0.16, align: "left" as const },
    { title: "Colegio", w: 0.3, align: "left" as const },
    { title: "Alumno", w: 0.3, align: "left" as const },
    { title: "Vence", w: 0.12, align: "right" as const },
    { title: "Monto", w: 0.12, align: "right" as const },
  ];
  const widths = cols.map((c) => c.w * CONTENT_W);
  const rowH = 15;
  const size = 8;

  const drawHeader = () => {
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: BLUE });
    let x = MARGIN;
    cols.forEach((c, i) => {
      const tw = ctx.bold.widthOfTextAtSize(c.title, size);
      const tx = c.align === "right" ? x + widths[i] - tw - 6 : x + 6;
      ctx.page.drawText(c.title, { x: tx, y: ctx.y - rowH + 9, size, font: ctx.bold, color: WHITE });
      x += widths[i];
    });
    ctx.y -= rowH;
  };
  drawHeader();

  const rows = ordenar(filas).map((f) => ({
    vencido: f.grupoKey === "0000-00",
    cells: [
      f.grupoKey === "0000-00" ? "Vencido" : grupoLabel(f.grupoKey).replace(" de", ""),
      safe(f.colegio),
      safe(f.alumno),
      ddmmyyyy(f.vencimiento) || "-",
      money(f.monto),
    ],
  }));

  rows.forEach((row, r) => {
    if (ctx.y < MARGIN + rowH) {
      newPage(ctx);
      drawHeader();
    }
    if (r % 2 === 1) {
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: ROW_ALT });
    }
    let x = MARGIN;
    row.cells.forEach((cell, i) => {
      const color = i === 0 && row.vencido ? RED : TEXT;
      const t = truncate(ctx.font, cell, size, widths[i] - 10);
      const tw = ctx.font.widthOfTextAtSize(t, size);
      const tx = cols[i].align === "right" ? x + widths[i] - tw - 6 : x + 6;
      ctx.page.drawText(t, { x: tx, y: ctx.y - rowH + 9, size, font: ctx.font, color });
      x += widths[i];
    });
    ctx.y -= rowH;
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
