// Só página. Três cliques seguidos (em até 600 ms) disparam; depois recomeça do zero.
export function contadorCliques(n = 3, ms = 600) {
  let marcas: number[] = [];
  return (agoraMs: number): boolean => {
    marcas = [...marcas.filter((m) => agoraMs - m <= ms), agoraMs].slice(-n);
    if (marcas.length >= n && agoraMs - marcas[0] <= ms) {
      marcas = [];
      return true;
    }
    return false;
  };
}
