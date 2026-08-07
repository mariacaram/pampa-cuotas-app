// Precios por cuota específicos de colegio, derivados de los datos reales (no del flyer nacional).
// Generado analizando: para cada (colegio, combo, período, cuotas reales), qué monto total pagó la
// MAYORÍA de los alumnos de ese grupo. Solo se guarda acá cuando ese total es MENOR al mínimo del
// flyer para ese combo (un precio realmente distinto, negociado aparte). Si el total es igual o mayor
// al flyer, NO se guarda — se deja que el flyer normal aplique y el excedente (extra) se absorba
// entero en la última cuota, nunca repartido (regla explícita de Paulina, 2026-08-07).
// Clave: "<organizacion en minúscula>|||<combo C1-C4>|||<periodo A|J>|||<cuotas reales 1-3>"
// Valor: monto de CADA cuota (ya con la seña de 10.000 descontada), igual que FLYER_ABRIL/FLYER_JULIO.
// Regenerado: 2026-08-07 (post actualización de 189 pedidos con datos reales del Excel de Paulina).
export const PRECIOS_COLEGIO: Record<string, number> = {
  "26 el charco|||C1|||A|||3": 33667,
  "26 esc dr ramon araujo|||C2|||A|||3": 40667,
  "26 imep tm|||C2|||A|||1": 98000,
  "27 col vocacional concepcion|||C1|||J|||1": 89500,
  "27 col vocacional concepcion|||C1|||J|||2": 51300,
  "27 el cajon|||C3|||A|||3": 40667,
  "27 esc belgrano tt|||C2|||A|||3": 42333,
  "27 esc belgrano tt|||C4|||A|||3": 53667,
  "27 nsv|||C1|||A|||3": 31667,
  "27 reina de la esperanza sec|||C3|||A|||3": 50667,
  "27 rio seco|||C2|||A|||3": 46667,
  "27 san luis gonzaga primaria|||C2|||J|||1": 95000,
  "27 san luis gonzaga primaria|||C2|||J|||2": 54000,
  "27 san luis gonzaga primaria|||C2|||J|||3": 38000,
  "colegio monserrat|||C1|||J|||2": 50500,
  "colegio monserrat|||C1|||J|||3": 34667,
  "esc marcos avellaneda|||C2|||A|||2": 49000,
  "esc osvaldo magnasco tt|||C2|||A|||3": 36000,
  "esc pellegrini|||C2|||A|||3": 37000,
  "esc presidente julio arg roca \"d\"|||C4|||A|||3": 49000,
  "esc presidente julio arg roca \"e\"|||C4|||A|||3": 49000,
  "esc presidente julio arg roca \"f\"|||C4|||A|||3": 49000,
  "esc. cooperativismo argentino|||C4|||A|||2": 72500,
  "esc. cooperativismo argentino|||C4|||A|||3": 48667,
  "lib san martin aguilares|||C4|||J|||2": 73000,
  "lib san martin aguilares|||C4|||J|||3": 59000,
  "los pinos|||C1|||A|||2": 47500,
  "panama tt|||C1|||A|||1": 75000,
  "panama tt|||C1|||A|||3": 26667,
  "rep de panama|||C1|||A|||1": 75000,
  "rep panama|||C1|||A|||1": 75000,
  "sec independencia concepcion|||C1|||A|||3": 32667,
  "tec 1 lules|||C2|||A|||1": 98000,
  "tec 1 lules|||C2|||A|||2": 50500,
  "tec 1 lules|||C2|||A|||3": 39000,
  "tec 1|||C4|||A|||1": 142000,
  "tecnica 1 prof rafael marino|||C1|||A|||1": 90000,
};
