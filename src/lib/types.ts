export type Alumno = {
  id: string;
  colegio: string;
  nombreOriginal: string;
  nombreEstandarizado: string;
  precioTotal: number;
  pagado: number;
  cuotasPactadas: number;
  atrasado: boolean;
  interes: number;
};

export type Dataset = {
  nombre: string;
  creadoEn: string;
  alumnos: Alumno[];
};

export type ColumnMapping = {
  colegio: string;
  alumno: string;
  precioTotal: string;
  pagado: string;
  cuotasPactadas: string | null;
};

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, unknown>[];
  headerRowIndex: number;
};
