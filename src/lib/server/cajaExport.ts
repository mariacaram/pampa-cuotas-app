import "server-only";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { getCaja } from "./caja";

function money(n: number): string {
  return "$ " + Math.round(n || 0).toLocaleString("es-AR");
}
function ddmmyyyy(iso: string): string {
  return iso ? iso.split("-").reverse().join("/") : "";
}

// ------------------------------ EXCEL ------------------------------
export async function buildCajaXlsx(desde: string, hasta: string): Promise<Buffer> {
  const c = await getCaja(desde, hasta);

  const resumen: (string | number)[][] = [
    ["Control de caja", `${ddmmyyyy(desde)} a ${ddmmyyyy(hasta)}`],
    ["Cantidad de pagos", c.cantidadPagos],
    ["Total cobrado", Math.round(c.totalCobrado)],
    ["Total bonificado", Math.round(c.totalBonificado)],
    ["Total interés", Math.round(c.totalInteres)],
    [],
    ["Medio de pago", "Cantidad", "Monto"],
    ...c.porMedio.map((m) => [m.forma, m.cantidad, Math.round(m.monto)]),
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
  wsResumen["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }];

  const detalle: (string | number)[][] = [
    ["Fecha", "Alumno", "Colegio", "Monto", "Forma de pago", "Interés", "Bonificación", "Nota"],
    ...c.pagos.map((p) => [
      ddmmyyyy(p.fecha),
      p.alumno,
      p.colegio,
      Math.round(p.monto),
      p.forma_de_pago,
      Math.round(p.interes),
      Math.round(p.bonificacion),
      p.nota,
    ]),
  ];
  const wsDetalle = XLSX.utils.aoa_to_sheet(detalle);
  wsDetalle["!cols"] = [
    { wch: 12 }, { wch: 26 }, { wch: 28 }, { wch: 12 },
    { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle pagos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ------------------------------ PDF ------------------------------
const BLUE = rgb(0.188, 0.447, 0.706);
const BLUE_DARK = rgb(0.153, 0.365, 0.584);
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

type Ctx = { pdf: PDFDocument; font: PDFFont; bold: PDFFont; page: PDFPage; y: number };

function safe(s: string): string {
  return (s ?? "").replace(/[^\x00-\xff]/g, (ch) => (ch === "–" ? "-" : ch === "…" ? "..." : "?"));
}
function truncate(font: PDFFont, text: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
  return t + "...";
}

export async function buildCajaPdf(desde: string, hasta: string): Promise<Buffer> {
  const c = await getCaja(desde, hasta);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pdf, font, bold, page: pdf.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN };

  const headH = 54;
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - headH, width: PAGE_W, height: headH, color: BLUE });
  ctx.page.drawText("Control de caja", { x: MARGIN, y: PAGE_H - 34, size: 18, font: bold, color: WHITE });
  ctx.page.drawText(`${ddmmyyyy(desde)}  a  ${ddmmyyyy(hasta)}`, {
    x: MARGIN,
    y: PAGE_H - 48,
    size: 9,
    font,
    color: rgb(0.85, 0.92, 0.99),
  });
  ctx.y = PAGE_H - headH - 20;

  const kpis = [
    { label: "Total cobrado", value: money(c.totalCobrado), accent: true },
    { label: "Pagos", value: String(c.cantidadPagos) },
    { label: "Bonificado", value: money(c.totalBonificado) },
    { label: "Interes", value: money(c.totalInteres) },
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
    ctx.page.drawText(safe(k.label), { x: x + 8, y: ctx.y - 16, size: 7, font, color: k.accent ? rgb(0.85, 0.92, 0.99) : MUTED });
    ctx.page.drawText(safe(truncate(bold, k.value, 13, boxW - 16)), { x: x + 8, y: ctx.y - 34, size: 13, font: bold, color: k.accent ? WHITE : TEXT });
  });
  ctx.y -= boxH + 16;

  // Por medio de pago
  ctx.page.drawText("Por medio de pago", { x: MARGIN, y: ctx.y, size: 10, font: bold, color: TEXT });
  ctx.y -= 16;
  const medioCols = [
    { title: "Medio", w: 0.5, align: "left" as const },
    { title: "Cantidad", w: 0.25, align: "right" as const },
    { title: "Monto", w: 0.25, align: "right" as const },
  ];
  drawTable(ctx, medioCols, c.porMedio.map((m) => [safe(m.forma), String(m.cantidad), money(m.monto)]));
  ctx.y -= 10;

  // Detalle de pagos
  ctx.page.drawText("Detalle de pagos", { x: MARGIN, y: ctx.y, size: 10, font: bold, color: TEXT });
  ctx.y -= 16;
  const cols = [
    { title: "Fecha", w: 0.12, align: "left" as const },
    { title: "Alumno", w: 0.26, align: "left" as const },
    { title: "Colegio", w: 0.24, align: "left" as const },
    { title: "Monto", w: 0.14, align: "right" as const },
    { title: "Medio", w: 0.14, align: "left" as const },
    { title: "Bonif.", w: 0.1, align: "right" as const },
  ];
  drawTable(
    ctx,
    cols,
    c.pagos.map((p) => [
      ddmmyyyy(p.fecha),
      safe(p.alumno),
      safe(p.colegio),
      money(p.monto),
      safe(p.forma_de_pago),
      p.bonificacion ? money(p.bonificacion) : "-",
    ])
  );

  return Buffer.from(await pdf.save());
}

type Col = { title: string; w: number; align: "left" | "right" };

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function drawTable(ctx: Ctx, cols: Col[], data: string[][]) {
  const rowH = 17;
  const size = 8;
  const widths = cols.map((c) => c.w * CONTENT_W);

  const drawHeader = () => {
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: BLUE });
    let x = MARGIN;
    cols.forEach((c, i) => {
      const w = widths[i];
      const tw = ctx.bold.widthOfTextAtSize(c.title, size);
      const tx = c.align === "right" ? x + w - tw - 6 : x + 6;
      ctx.page.drawText(c.title, { x: tx, y: ctx.y - rowH + 9, size, font: ctx.bold, color: WHITE });
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
      ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: ROW_ALT });
    }
    let x = MARGIN;
    row.forEach((cell, i) => {
      const w = widths[i];
      const t = truncate(ctx.font, cell, size, w - 10);
      const tw = ctx.font.widthOfTextAtSize(t, size);
      const tx = cols[i].align === "right" ? x + w - tw - 6 : x + 6;
      ctx.page.drawText(t, { x: tx, y: ctx.y - rowH + 9, size, font: ctx.font, color: TEXT });
      x += w;
    });
    ctx.y -= rowH;
  });

  if (data.length === 0) {
    ctx.page.drawText("Sin pagos en el periodo.", { x: MARGIN + 6, y: ctx.y - 12, size, font: ctx.font, color: MUTED });
    ctx.y -= rowH;
  }
}
