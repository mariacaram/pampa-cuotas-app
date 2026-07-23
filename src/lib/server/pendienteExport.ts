import "server-only";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { getPendiente } from "./stats";

function money(n: number): string {
  return "$ " + Math.round(n || 0).toLocaleString("es-AR");
}

// ------------------------------ EXCEL ------------------------------
export async function buildPendienteXlsx(organizacion?: string): Promise<Buffer> {
  const d = await getPendiente(organizacion);

  const rows: (string | number)[][] = [
    ["Pendiente de cobro", d.scope],
    ["Fecha", new Date().toISOString().slice(0, 10)],
    [],
    ["Total pendiente", Math.round(d.totalPendiente)],
    ["Alumnos con saldo", d.alumnosPendientes],
    ["Alumnos atrasados", d.alumnosAtrasados],
    ["Monto vencido (est.)", Math.round(d.montoVencido)],
    [],
  ];

  if (!organizacion) {
    rows.push(["Colegio", "Alumnos pendientes", "Atrasados", "Total pendiente", "Monto vencido (est.)"]);
    for (const c of d.porColegio) {
      rows.push([
        c.organizacion,
        c.alumnosPendientes,
        c.alumnosAtrasados,
        Math.round(c.totalPendiente),
        Math.round(c.montoVencido),
      ]);
    }
  } else {
    rows.push([
      "Alumno",
      "Saldo",
      "Cuotas pagadas",
      "Cuotas esperadas",
      "Cuotas atrasadas",
      "Atrasado",
      "Situación",
    ]);
    for (const a of d.alumnos) {
      rows.push([
        a.alumno,
        Math.round(a.saldo),
        a.cuotasPagadas,
        a.cuotasEsperadas,
        a.cuotasAtrasadas,
        a.atrasado ? "SÍ" : "",
        a.situacion,
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = organizacion
    ? [{ wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }]
    : [{ wch: 34 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pendiente de cobro");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ------------------------------ PDF ------------------------------
const BLUE = rgb(0.188, 0.447, 0.706); // #3072b4
const BLUE_DARK = rgb(0.153, 0.365, 0.584); // #275d95
const RED = rgb(0.86, 0.15, 0.15);
const TEXT = rgb(0.09, 0.14, 0.18);
const MUTED = rgb(0.42, 0.49, 0.55);
const CARD = rgb(0.96, 0.97, 0.98);
const ROW_ALT = rgb(0.945, 0.965, 0.985);
const WHITE = rgb(1, 1, 1);
const BORDER = rgb(0.85, 0.88, 0.91);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Ctx = {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
};

function truncate(font: PDFFont, text: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
  return t + "…";
}

// pdf-lib usa fuentes estándar (WinAnsi); limpiamos chars fuera de ese set.
function safe(s: string): string {
  return (s ?? "").replace(/[^\x00-\xff]/g, (ch) => (ch === "–" ? "-" : ch === "…" ? "..." : "?"));
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

export async function buildPendientePdf(organizacion?: string): Promise<Buffer> {
  const d = await getPendiente(organizacion);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pdf, font, bold, page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN };

  // Encabezado (banda azul)
  const headH = 54;
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - headH, width: PAGE_W, height: headH, color: BLUE });
  ctx.page.drawText("Pendiente de cobro", {
    x: MARGIN,
    y: PAGE_H - 34,
    size: 18,
    font: bold,
    color: WHITE,
  });
  ctx.page.drawText(safe(d.scope) + "  ·  " + new Date().toISOString().slice(0, 10), {
    x: MARGIN,
    y: PAGE_H - 48,
    size: 9,
    font,
    color: rgb(0.85, 0.92, 0.99),
  });
  ctx.y = PAGE_H - headH - 20;

  // Tarjetas KPI
  const kpis = [
    { label: "Total pendiente", value: money(d.totalPendiente), accent: true },
    { label: "Alumnos con saldo", value: String(d.alumnosPendientes) },
    { label: "Alumnos atrasados", value: String(d.alumnosAtrasados) },
    { label: "Monto vencido (est.)", value: money(d.montoVencido) },
  ];
  const gap = 10;
  const boxW = (CONTENT_W - gap * 3) / 4;
  const boxH = 46;
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (boxW + gap);
    ctx.page.drawRectangle({
      x,
      y: ctx.y - boxH,
      width: boxW,
      height: boxH,
      color: k.accent ? BLUE_DARK : CARD,
      borderColor: k.accent ? BLUE_DARK : BORDER,
      borderWidth: 1,
    });
    ctx.page.drawText(safe(k.label), {
      x: x + 8,
      y: ctx.y - 16,
      size: 7,
      font,
      color: k.accent ? rgb(0.85, 0.92, 0.99) : MUTED,
    });
    ctx.page.drawText(safe(truncate(bold, k.value, 13, boxW - 16)), {
      x: x + 8,
      y: ctx.y - 34,
      size: 13,
      font: bold,
      color: k.accent ? WHITE : TEXT,
    });
  });
  ctx.y -= boxH + 10;

  ctx.page.drawText(
    safe("Vencimientos: 1a cuota a fin del mes de la orden; las siguientes, el 15 de cada mes."),
    { x: MARGIN, y: ctx.y, size: 7.5, font, color: MUTED }
  );
  ctx.y -= 18;

  // Tabla (según haya o no colegio seleccionado)
  if (!organizacion) {
    const cols = [
      { title: "Colegio", w: 0.4, align: "left" as const },
      { title: "Pendientes", w: 0.15, align: "right" as const },
      { title: "Atrasados", w: 0.15, align: "right" as const },
      { title: "Total pendiente", w: 0.3, align: "right" as const },
    ];
    const data = d.porColegio.map((c) => [
      safe(c.organizacion),
      String(c.alumnosPendientes),
      String(c.alumnosAtrasados),
      money(c.totalPendiente),
    ]);
    drawTable(ctx, cols, data, "Colegios ordenados por lo que falta cobrar");
  } else {
    const cols = [
      { title: "Alumno", w: 0.34, align: "left" as const },
      { title: "Saldo", w: 0.18, align: "right" as const },
      { title: "Cuotas (pag/esp)", w: 0.18, align: "right" as const },
      { title: "Atraso", w: 0.15, align: "right" as const },
      { title: "Situacion", w: 0.15, align: "left" as const },
    ];
    const data = d.alumnos.map((a) => [
      safe(a.alumno),
      money(a.saldo),
      `${a.cuotasPagadas}/${a.cuotasEsperadas}`,
      a.atrasado ? `${a.cuotasAtrasadas} atras.` : "al dia",
      safe(a.situacion),
    ]);
    drawTable(ctx, cols, data, `Alumnos con saldo en ${safe(organizacion)} (atrasados primero)`);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

type Col = { title: string; w: number; align: "left" | "right" };

function drawTable(ctx: Ctx, cols: Col[], data: string[][], caption: string) {
  const rowH = 18;
  const size = 8.5;
  const widths = cols.map((c) => c.w * CONTENT_W);

  ctx.page.drawText(safe(caption), { x: MARGIN, y: ctx.y, size: 10, font: ctx.bold, color: TEXT });
  ctx.y -= 16;

  const drawHeader = () => {
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - rowH + 4,
      width: CONTENT_W,
      height: rowH,
      color: BLUE,
    });
    let x = MARGIN;
    cols.forEach((c, i) => {
      const w = widths[i];
      const t = c.title;
      const tw = ctx.bold.widthOfTextAtSize(t, size);
      const tx = c.align === "right" ? x + w - tw - 6 : x + 6;
      ctx.page.drawText(t, { x: tx, y: ctx.y - rowH + 10, size, font: ctx.bold, color: WHITE });
      x += w;
    });
    ctx.y -= rowH;
  };

  drawHeader();

  data.forEach((row, r) => {
    if (ctx.y < MARGIN + rowH) {
      newPage(ctx);
      drawHeader();
    }
    if (r % 2 === 1) {
      ctx.page.drawRectangle({
        x: MARGIN,
        y: ctx.y - rowH + 4,
        width: CONTENT_W,
        height: rowH,
        color: ROW_ALT,
      });
    }
    let x = MARGIN;
    row.forEach((cell, i) => {
      const w = widths[i];
      const isAtraso = cols[i].title === "Atraso" && /atras\./.test(cell);
      const color = isAtraso ? RED : TEXT;
      const t = truncate(ctx.font, cell, size, w - 12);
      const tw = ctx.font.widthOfTextAtSize(t, size);
      const tx = cols[i].align === "right" ? x + w - tw - 6 : x + 6;
      ctx.page.drawText(t, { x: tx, y: ctx.y - rowH + 10, size, font: ctx.font, color });
      x += w;
    });
    ctx.y -= rowH;
  });
}
