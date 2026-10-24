/*
//  Resuelve  dy/dx = f(x, y),  y(x0) = y0  dando n pasos de tamaño h.
//  Devuelve una fila por paso con xn, yn, k1, k2, k3, k4 y yn+1,
//  igual que la tabla que se hace a mano o en Excel.
*/
function rk4(f, x0, y0, h, n) {
  const filas = [];
  let x = x0;
  let y = y0;

  for (let i = 0; i < n; i++) {
    const k1 = f(x, y);
    const k2 = f(x + h / 2, y + (h / 2) * k1);
    const k3 = f(x + h / 2, y + (h / 2) * k2);
    const k4 = f(x + h, y + h * k3);

    const ySiguiente = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    filas.push({ n: i, x, y, k1, k2, k3, k4, ySiguiente });

    x = x0 + (i + 1) * h;   // se calcula así para no acumular error de redondeo en x
    y = ySiguiente;
  }

  return { filas, xFinal: x, yFinal: y };
}
