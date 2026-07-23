import { Alumno, Dataset } from "./types";

// Datos ficticios solo para demostración — no corresponden a alumnos reales.
const sample: Omit<Alumno, "id">[] = [
  { colegio: "Instituto San Martín", nombreOriginal: "gomez, lucia", nombreEstandarizado: "Gomez, Lucia", precioTotal: 90000, pagado: 90000, cuotasPactadas: 3, atrasado: false, interes: 0 },
  { colegio: "Instituto San Martín", nombreOriginal: "PEREZ  matias", nombreEstandarizado: "Perez Matias", precioTotal: 90000, pagado: 30000, cuotasPactadas: 3, atrasado: false, interes: 0 },
  { colegio: "Instituto San Martín", nombreOriginal: "diaz, camila", nombreEstandarizado: "Diaz, Camila", precioTotal: 90000, pagado: 30000, cuotasPactadas: 3, atrasado: true, interes: 4500 },
  { colegio: "Instituto San Martín", nombreOriginal: "torres agustin", nombreEstandarizado: "Torres Agustin", precioTotal: 90000, pagado: 60000, cuotasPactadas: 3, atrasado: false, interes: 0 },
  { colegio: "Colegio Belgrano", nombreOriginal: "fernandez, MILA", nombreEstandarizado: "Fernandez, Mila", precioTotal: 75000, pagado: 25000, cuotasPactadas: 3, atrasado: true, interes: 3000 },
  { colegio: "Colegio Belgrano", nombreOriginal: "rios  Benjamin", nombreEstandarizado: "Rios Benjamin", precioTotal: 75000, pagado: 75000, cuotasPactadas: 3, atrasado: false, interes: 0 },
  { colegio: "Colegio Belgrano", nombreOriginal: "sosa, valentina", nombreEstandarizado: "Sosa, Valentina", precioTotal: 75000, pagado: 50000, cuotasPactadas: 3, atrasado: false, interes: 0 },
  { colegio: "Escuela Normal", nombreOriginal: "acosta thiago", nombreEstandarizado: "Acosta Thiago", precioTotal: 60000, pagado: 20000, cuotasPactadas: 2, atrasado: true, interes: 2000 },
  { colegio: "Escuela Normal", nombreOriginal: "juarez, delfina", nombreEstandarizado: "Juarez, Delfina", precioTotal: 60000, pagado: 60000, cuotasPactadas: 2, atrasado: false, interes: 0 },
  { colegio: "Escuela Normal", nombreOriginal: "molina  santino", nombreEstandarizado: "Molina Santino", precioTotal: 60000, pagado: 0, cuotasPactadas: 2, atrasado: false, interes: 0 },
];

export function buildSampleDataset(): Dataset {
  return {
    nombre: "Datos de ejemplo",
    creadoEn: new Date().toISOString(),
    alumnos: sample.map((a, i) => ({ ...a, id: `demo-${i + 1}` })),
  };
}
