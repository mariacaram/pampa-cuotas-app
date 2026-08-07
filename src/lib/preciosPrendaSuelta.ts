// Precios por cuota de PRENDAS SUELTAS (un solo ítem, sin armar ninguno de los 4 combos),
// específicos de cada colegio — derivados de los datos reales. Cada colegio tiene su propio
// precio fijo y consistente para cada prenda (verificado: 100% de coincidencia en casi todos
// los grupos con múltiples pedidos). No existe un precio "nacional" único para esto.
// Clave: "<organizacion en minúscula>|||<CAMPERA|BUZO|CHOMBA|BABUCHA>|||<periodo A|J>|||<cuotas reales 1-3>"
// Valor: monto de CADA cuota (ya con la seña de 10.000 descontada).
// El caso "plan 1 (contado)" no necesita entrada acá: el sistema ya usa el total tal cual.
// Generado: 2026-08-07.
export const PRECIOS_PRENDA_SUELTA: Record<string, number> = {
  "26 el charco|||CHOMBA|||A|||1": 54000,
  "26 liceo|||CHOMBA|||A|||1": 58000,
  "27 comercio 3|||CHOMBA|||A|||1": 50000,
  "27 comercio nro 3|||BUZO|||A|||3": 42667,
  "27 esc comercio de famaillá|||CHOMBA|||A|||1": 54000,
  "27 esc rivadavia|||CHOMBA|||A|||2": 21000,
  "27 los cerros|||CAMPERA|||A|||1": 78000,
  "27 san javier|||BUZO|||A|||2": 49000,
  "27 san patricio sec|||CAMPERA|||A|||1": 78000,
  "27 san patricio sec|||CAMPERA|||A|||2": 43000,
  "esc normal|||BUZO|||A|||1": 68000,
  "esc normal|||BUZO|||A|||2": 34000,
  "esc presidente julio arg roca \"f\"|||CHOMBA|||A|||1": 44000,
  "esc primaria graneros belisario lopez|||CHOMBA|||A|||2": 56000,
  "escuela tecnica n1 monteros profes|||BUZO|||A|||1": 55000,
  "escuela tecnica n1 monteros profes|||BUZO|||A|||2": 27501,
  "escuela tecnica n1 monteros profes|||BUZO|||A|||3": 18334,
  "escuela tecnica n1 monteros profes|||BUZO|||A|||4": 13751,
  "escuela tecnica n1 monteros profes|||BUZO|||A|||5": 11001,
  "integral|||CAMPERA|||A|||3": 27333,
  "rep de panama|||BUZO|||A|||1": 75000,
  "rep de panama|||BUZO|||A|||2": 55000,
  "rep de panama|||BUZO|||A|||4": 23750,
};
