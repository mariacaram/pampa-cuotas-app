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
};

// Un pago nuevo cargado desde la app.
export type Pago = {
  id: number | string;
  alumno_id: string;
  fecha: string;
  monto: number;
  forma_de_pago: string;
  interes: number;
  nota: string;
  creado_en: string;
};

export type NuevoPago = {
  alumno_id: string;
  fecha: string;
  monto: number;
  forma_de_pago: string;
  interes: number;
  nota: string;
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
};

export type Colegio = {
  organizacion: string;
  cantidadAlumnos: number;
};
