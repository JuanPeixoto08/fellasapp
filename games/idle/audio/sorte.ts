// Sorte com semente das partituras (o mesmo giro soa igual toda vez): um LCG de 32 bits.
export function aleatorio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}
