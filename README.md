# Pampa · Control de cuotas

Prototipo web para cargar el Excel de un colegio y hacer seguimiento del pago de cada alumno:
cuotas pactadas, cuotas pagadas/pendientes, saldo, y aplicar un interés manual cuando el pago
está atrasado.

## Cómo funciona

1. Subís el Excel del colegio (cualquier formato de columnas — la app te deja indicar qué
   columna es Colegio, Alumno, Precio total y Pagado).
2. Elegís el colegio y, según eso, se filtran los alumnos correspondientes.
3. Podés normalizar el nombre de los alumnos (mayúsculas/minúsculas, espacios) uno por uno o
   todos juntos.
4. Para cada alumno se calculan cuotas pagadas/pendientes y el saldo. Si el pago está
   atrasado, tildás la casilla y cargás el monto de interés a aplicar.

Los datos se guardan solo en el navegador (localStorage) — no hay backend ni base de datos,
pensado como prototipo para mostrar a un cliente.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).
