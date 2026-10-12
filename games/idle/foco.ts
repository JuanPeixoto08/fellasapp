// Foco do teclado entre um desenho e outro: redesenhar troca os botões por novos e o foco cairia no <body>. Cada item
// focável ganha `data-foco` com uma chave estável; antes de redesenhar guarda a chave de quem tinha o foco e depois
// devolve pro equivalente. Item desabilitado (ocupado com a ação) não pega foco: fica pendente para o próximo desenho.

export function criarFoco(raiz: HTMLElement) {
  let pendente: string | null = null;
  return {
    /** Antes de redesenhar: a chave do item com foco dentro de `raiz` (sem foco em nada: a que ficou pendente). */
    guardar(): string | null {
      const ativo = document.activeElement;
      if (ativo instanceof HTMLElement && raiz.contains(ativo)) return ativo.dataset.foco ?? null;
      return !ativo || ativo === document.body ? pendente : null;
    },
    /** Depois de redesenhar: foca o item com a mesma chave (se ele está desabilitado, tenta no próximo desenho). */
    devolver(chave: string | null): void {
      pendente = null;
      if (!chave) return;
      const alvo = [...raiz.querySelectorAll<HTMLElement>('[data-foco]')].find((x) => x.dataset.foco === chave);
      if (!alvo || document.activeElement === alvo) return;
      if ((alvo as HTMLButtonElement).disabled) pendente = chave;
      else alvo.focus({ preventScroll: true });
    },
  };
}
