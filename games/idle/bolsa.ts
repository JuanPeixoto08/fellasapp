// Contas e textos da tela da Bolsa (puro). Quem decide preço, compra e venda é o banco (0043); aqui só se mostra.
import { EMPRESAS_BOLSA, MELHORIAS_BOLSA, type EmpresaBolsa } from './bolsaMotor';
import type { BolsaPosicao, MelhoriaBolsa } from '../shared/types';
import { GERADORES } from './nomes';

export const empresa = (id: number): EmpresaBolsa => EMPRESAS_BOLSA.find((e) => e.id === id)!;

/** "+4,2%", "−3,1%" (sinal de menos de verdade), "+31%" (10% ou mais sem casa), "0%". */
export function pct(x: number): string {
  if (Math.abs(x) < 0.0005) return '0%';
  const v = Math.abs(x) * 100;
  const n = (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('pt-BR');
  return `${x > 0 ? '+' : '−'}${n}%`;
}

/** Variação desde o minuto anterior e desde o começo da hora (o histórico vem do mais velho pro mais novo). */
export function variacao(h: number[]): { minuto: number; hora: number } {
  if (h.length < 2) return { minuto: 0, hora: 0 };
  const ult = h[h.length - 1];
  return { minuto: ult / h[h.length - 2] - 1, hora: ult / h[0] - 1 };
}

/** Lucro em % sobre o preço médio pago (com a corretagem), em segundos de produção. */
export const lucro = (valor: number, p: BolsaPosicao): number => valor / (p.custo / p.qtd) - 1;

/** Quantas dá pra comprar agora: o F$ (com a corretagem) e o espaço no limite. */
export function maxCompra(valuation: number, valor: number, r: number, limite: number, tem: number, corretagem: number): number {
  const unidade = valor * r * (1 + corretagem);
  if (unidade <= 0) return 0;
  return Math.max(0, Math.min(limite - tem, Math.floor(valuation / unidade)));
}

/** A empresa da Bolsa ligada a um gerador (undefined pros que não têm). */
export const empresaDoGerador = (gid: number): EmpresaBolsa | undefined => EMPRESAS_BOLSA.find((e) => e.gerador === gid);

/** De onde vem o limite: "Limite: 100 + 5 Curso online + 25 do Escritório" (o banco manda só o total). */
export function contaLimite(id: number, limite: number, escritorio: number): string {
  const bonus = MELHORIAS_BOLSA.escritorio.bonus[escritorio];
  const gerador = GERADORES[empresa(id).gerador - 1];
  return `Limite: 100 + ${limite - 100 - bonus} ${gerador}${bonus ? ` + ${bonus} do Escritório` : ''}`;
}

export const acoes = (n: number) => (n === 1 ? '1 ação' : `${n} ações`);

const porcento = (x: number) => `${(x * 100).toLocaleString('pt-BR')}%`;
const efeito = (tipo: MelhoriaBolsa, nivel: number) =>
  tipo === 'corretor'
    ? `Corretagem ${porcento(MELHORIAS_BOLSA.corretor.corretagem[nivel])}`
    : `+${MELHORIAS_BOLSA.escritorio.bonus[nivel]} ações em cada empresa`;

/** O nível que você tem: nome e efeito ("Sem corretor · Corretagem 5%"). */
export function melhoriaAtual(tipo: MelhoriaBolsa, nivel: number): { nome: string; efeito: string } {
  const nome = nivel === 0 ? (tipo === 'corretor' ? 'Sem corretor' : 'Sem escritório') : MELHORIAS_BOLSA[tipo].nomes[nivel - 1];
  return { nome, efeito: efeito(tipo, nivel) };
}

/** O próximo nível (custo em segundos de produção), ou null no 5. */
export function proximaMelhoria(tipo: MelhoriaBolsa, nivel: number) {
  if (nivel >= 5) return null;
  return { nivel: nivel + 1, nome: MELHORIAS_BOLSA[tipo].nomes[nivel], efeito: efeito(tipo, nivel + 1), segundos: MELHORIAS_BOLSA[tipo].custo[nivel] };
}

export const textoQuebra = (rjAte: number, tick: number) => `Quebrou · volta em ${Math.max(1, rjAte - tick)} min`;

/** "Suas 120 ações da Cripto do Primo viraram pó." (artigo do nome: "do" para NFT/Uber/Pastel/Açaí, "da" para o resto). */
const DO = new Set(['MEME', 'JEGU', 'PSTL', 'ACAI', 'COCH']);
/** "do" ou "da" antes do nome da empresa. */
export const deEmpresa = (e: EmpresaBolsa) => (DO.has(e.codigo) ? 'do' : 'da');
export const avisosPo = (po: { empresa: number; qtd: number }[]): string[] =>
  po.map(({ empresa: id, qtd }) => {
    const e = empresa(id);
    const de = deEmpresa(e);
    return qtd === 1 ? `Sua 1 ação ${de} ${e.nome} virou pó.` : `Suas ${qtd} ações ${de} ${e.nome} viraram pó.`;
  });

/** Quando buscar o mercado de novo: logo depois da virada do minuto (nunca antes de 1 s). */
export const proximaBusca = (viraEmMs: number) => Math.max(1000, viraEmMs + 300);
/** Quanto falta pra virar o minuto agora, dado o que a busca disse e quando ela voltou (nunca negativo). */
export const faltaVirar = (viraEmMs: number, buscadoEm: number, agora: number) => Math.max(0, viraEmMs - (agora - buscadoEm));
/** Depois de uma resposta do jogo: buscar o mercado já? (gaveta aberta, com trader, e nenhuma busca marcada nem no caminho) */
export const buscarBolsaAgora = (aberta: boolean, trader: boolean, agendada: boolean) => aberta && trader && !agendada;
/** Recusas da Bolsa que querem o mercado (e a carteira) de novo. */
export const RECARREGA_BOLSA = ['idle_bolsa_preco_mudou', 'idle_bolsa_rj', 'idle_bolsa_limite', 'idle_bolsa_sem_acoes', 'idle_bolsa_fechada', 'idle_bolsa_nivel'];
