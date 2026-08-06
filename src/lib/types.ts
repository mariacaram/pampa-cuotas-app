// Datos base de un alumno, tal como vienen de la planilla (export del sistema).
// No se modifican al cargar pagos; son el punto de partida del cálculo.
export type AlumnoBase = {
  alumno_id: string;
  alumno: string;
  nombre_cliente: string;
  organizacion: string;
  nro_orden: string;
  estado_orden: string;
  fecha_orden: string;
  forma_de_pago: string;
  plan_cuotas: number;
  cuotas_generadas: number;
  cuotas_pagadas_base: number;
  total_asignado: number;
  monto_pagado_base: number;
  saldo_base: number;
  situacion_base: string;
  // Detalle de producto (opcional; viene del export del sistema).
  fecha_creacion_orden?: string;
  productos?: string;
  producto1?: string;
  talle1?: string;
  producto2?: string;
  talle2?: string;
  producto3?: string;
  talle3?: string;
};

// Un pago nuevo cargado desde la app.
export type Pago = {
  id: number | string;
  alumno_id: string;
  fecha: string;
  monto: number;
  forma_de_pago: string;
  interes: number; // monto de interés (calculado del %)
  interes_pct: number; // % de interés por atraso aplicado
  bonificacion: number; // monto bonificado / descuento otorgado
  nota: string;
  creado_en: string;
};

export type NuevoPago = {
  alumno_id: string;
  fecha: string;
  monto: number;
  forma_de_pago: string;
  interes: number;
  interes_pct: number;
  bonificacion: number;
  nota: string;
};

// Alta de una venta nueva cargada desde la app (nuevo alumno/orden).
export type NuevaVenta = {
  alumno: string;
  organizacion: string;
  nombre_cliente?: string;
  total_asignado: number;
  plan_cuotas: number;
  forma_de_pago: string;
  fecha_orden: string;
  // Seña (1ª cuota) ya cobrada al hacer la venta. Editable; si es 0, sin seña.
  sena?: number;
  // Productos de la venta (opcional): alimentan "Productos estrella".
  producto1?: string;
  talle1?: string;
  producto2?: string;
  talle2?: string;
  producto3?: string;
  talle3?: string;
};

// Una cuota del plan de pagos, con su vencimiento y estado.
export type CuotaPlan = {
  numero: number;
  vencimiento: string; // fecha ISO (YYYY-MM-DD)
  monto: number;
  estado: "pagada" | "pendiente" | "vencida";
};

export type Situacion = "PAGO TOTAL" | "PAGO PARCIAL" | "SIN PAGOS";

// Alumno con los totales recalculados en vivo (base + pagos nuevos).
export type AlumnoComputed = AlumnoBase & {
  pagos: Pago[];
  montoPagadoTotal: number;
  interesTotal: number;
  saldo: number;
  montoCuota: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  situacion: Situacion;
  // Atraso según vencimientos (1ª a fin de mes de la orden; resto el 15).
  cuotasEsperadas: number;
  cuotasAtrasadas: number;
  atrasado: boolean;
  montoVencido: number;
  proximoVencimiento: string; // fecha ISO de la próxima cuota impaga, "" si está saldado
  bonificacionTotal: number;
  cuotasPlan: CuotaPlan[]; // plan de cuotas mes por mes (vencimiento + estado)
};

export type Colegio = {
  organizacion: string;
  cantidadAlumnos: number;
};

// Usuario logueado que se pasa del servidor a la app (null = login no configurado / abierto).
export type SessionUsuario = {
  email: string;
  nombre: string | null;
  rol: "admin" | "miembro";
} | null;
