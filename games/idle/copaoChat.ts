// O chat da galera no fim de uma noite do copão (lugar 4 do Mapa do rolê): 8 a 12 mensagens curtas, montadas pela nota de
// cada copão do cardápio, pelas partes da nota (o par que brigou, o preço, a força, a moda), pelo PT, pela sexta, pelo DJ
// e por como a galera mudou. Zoeira ácida com o copão e com a noite; a galera é inventada (apelidos genéricos).
// Os DJs são artistas de verdade: só aparecem como "<DJ> tocou <estilo>…" — nunca falam, nunca opinam, nada de fato
// inventado sobre eles. A sorte é fixa pela noite (chat_seed) e pela pessoa: reabrir mostra o mesmo chat.
import {
  aguenta, BASES, custoBeneficio, DJS, EXTRAS, MISTURAS, PONTOS, rotulos, TAMANHOS, type CopaoNaNoite, type UltimaNoite,
} from './copao';

export type TipoMensagem = 'galera' | 'pt' | 'dj';
export type MensagemChat = { autor: string; texto: string; tipo: TipoMensagem };

/** A galera do bar (inventada; nenhum é gente de verdade). */
export const GALERA: readonly string[] = [
  '@primo_do_ze', '@tia_do_zap', '@vizinho_de_cima', '@dono_do_isopor', '@motorista_da_vez', '@ex_que_voltou',
  '@gerente_do_role', '@quem_trouxe_gelo', '@bonde_da_firma', '@crush_de_ontem', '@cunhado_sincero', '@rei_do_aux',
];

/** Sorte determinística (mulberry32) a partir da noite e da pessoa. */
function sorte(seed: number, usuario: string | null): () => number {
  let h = 2166136261 ^ seed;
  for (const ch of `${seed}:${usuario ?? 'anon'}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pegar = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const embaralhar = <T,>(r: () => number, xs: T[]): T[] => {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
};
const minusculo = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const NOTA = {
  top: ['{nome} é patrimônio do bar. Tombem.', 'Pedi {nome} e virei outra pessoa. Melhor.', 'Quem inventou {nome} merece estátua na praça.',
    'Chorei tomando {nome}. De alegria, dessa vez.'],
  bom: ['{nome} desceu redondo, sem drama.', '{nome} tá bom. Não é amor, mas é carinho.', 'Repeti {nome} sem nem perceber.',
    '{nome} é aquele amigo que não brilha mas nunca falha.'],
  meh: ['{nome} é ok. Tipo amizade de trabalho.', '{nome} não ofende, mas também não defende.', 'Tomei {nome} por educação.',
    '{nome} tem gosto de "tanto faz".'],
  ruim: ['Quem montou {nome} odeia a gente.', '{nome} tem gosto de decisão errada.', 'Joguei {nome} na planta e a planta morreu.',
    '{nome}: nem com gelo, nem com fé.'],
};
const PAR_RUIM = ['{a} com {b}?? Quem autorizou isso?', 'Misturar {a} com {b} devia dar cadeia.', '{a} com {b} é briga de família dentro do copo.'];
const PAR_BOM = ['{a} com {b} é casamento que deu certo.', 'Alguém finalmente juntou {a} com {b}. Obrigado.'];
const CARO = ['{tamanho} a {preco} fichas é assalto à mão armada.', 'Paguei {preco} fichas num {tamanho}. Vou parcelar em 12 vezes.',
  'Por {preco} fichas eu queria levar a louça de lembrança.'];
const BARATO = ['{preco} fichas num {tamanho} desses? O dono tá maluco, aproveita.', 'Copão barato assim só pode ser lavagem de dinheiro.'];
const FRACO = ['Isso aí é só {mistura}.', 'Tomei três {nome} e tô mais sóbrio que o motorista.', '{nome} é suco com autoestima.'];
const FORTE = ['{nome} é {base} com um respingo de {mistura}.', 'Um gole de {nome} e eu vi meus antepassados.', '{nome} tira tinta de parede.'];
const PONTO = ['{nome} tá na medida: dá pra tomar a noite toda e lembrar do nome do rolê.', 'Força certinha em {nome}. Quem fez sabe o que faz.'];
const MODA2 = ['{base} com {mistura} é o copão da moda, todo mundo pediu.', 'Todo mundo de {base} com {mistura} na mão. Virou uniforme.'];
const MODA1 = ['Pelo menos metade de {nome} tá na moda.', '{nome} tá meio na moda. Meio.'];
const BALDE = ['Dividimos um balde em seis. Agora somos família.', 'Pedi um balde pra mim. Só pra mim. Não me julga.'];
const EXTRA = ['A parte mais sóbria de {nome} é {extra}.', 'Pedi {nome} só pelo enfeite de {extra}. Arrependido.'];
const PT = ['DEU PT NO MEU PRIMO', 'Alguém deu PT abraçado na caixa de som.', '{nome} derrubou um adulto de 1,90.',
  'Achei um sapato na pista. Só um. Culpa de {nome}.', 'Tô segurando o cabelo de três pessoas ao mesmo tempo.'];
const SEXTA = ['Sexta lotada, fila até a esquina.', 'Sexta é outra coisa: o bar parecia metrô às 18h.'];
const DJ = ['{dj} tocou {estilo} e a pista não sentou nem pra amarrar o tênis.', '{dj} tocou {estilo} até fechar e o bar inteiro virou clipe.',
  '{dj} tocou {estilo} e eu esqueci que trabalho amanhã.'];
const DJ_BASE = ['{dj} tocou {estilo} e o copão de {base} acabou antes da música.'];
const GALERA_MAIS = ['Trouxe meus primos. Semana que vem trago a família toda.', 'Contei pro grupo da firma. Amanhã vem todo mundo.'];
const GALERA_MENOS = ['Metade da galera foi pro bar da frente.', 'Saí no meio da noite. Não volto tão cedo.'];
const GALERA_PT = ['Depois do PT, o grupo do rolê ficou em silêncio.'];
const PREJUIZO = ['O bar vendeu a noite toda e ainda tá no prejuízo. Talento.'];
const VAZIO = ['Bar aberto e cardápio vazio. Bebi água da pia.', 'Cheguei, não tinha copão, fui embora. Cinco estrelas pro banheiro.'];
const SAIU = ['O copão que eu tava tomando saiu do cardápio no meio da noite. Fiquei segurando o gelo.',
  'Tiraram meu copão do cardápio sem aviso. Nem deu tempo de dar nota.', 'Pedi o mesmo de antes e o copão tinha sumido do cardápio.'];
const POUCO = ['Bar vazio, só eu e o gelo.'];
const ENCHE = ['Quem levou meu isqueiro devolve.', 'Alguém viu a tampa do isopor?', 'Fila do banheiro maior que a do bar.',
  'Meu uber cancelou três vezes. Fico mais um.', 'O gelo acabou às 23h. Tragédia nacional.', 'Jurei que ia embora cedo. Mentira.',
  'Perdi meu amigo. Se achar, devolve no balcão.', 'Quem tá pagando a próxima rodada? Ninguém? Entendi.'];

function preencher(t: string, c: CopaoNaNoite | null, extra: Record<string, string> = {}): string {
  const v: Record<string, string> = c ? {
    nome: c.nome, base: BASES[c.base - 1].nome, mistura: minusculo(MISTURAS[c.mistura - 1].nome), extra: minusculo(EXTRAS[c.extra - 1].nome),
    tamanho: minusculo(TAMANHOS[c.tamanho - 1].nome), preco: String(c.preco),
  } : {};
  return t.replace(/\{(\w+)\}/g, (_, k: string) => extra[k] ?? v[k] ?? '');
}

/** O chat da noite (8 a 12 mensagens), igual toda vez que abre pra mesma noite e a mesma pessoa. */
export function chatDaNoite(n: UltimaNoite, usuario: string | null): MensagemChat[] {
  const r = sorte(n.chat_seed, usuario);
  // cada frase-modelo sai uma vez só por noite (dois copões não ganham a mesma piada)
  const usados = new Set<string>();
  const tpl = (pool: readonly string[]): string => {
    const livres = pool.filter((t) => !usados.has(t));
    const t = pegar(r, livres.length ? livres : pool);
    usados.add(t);
    return t;
  };
  const total = 8 + Math.floor(r() * 5);
  const fixas: [string, TipoMensagem][] = [];
  const soltas: [string, TipoMensagem][] = [];

  // uma pela nota de cada copão (os 3 mais vendidos, no máximo)
  const copoes = [...n.copoes].sort((a, b) => b.vendidos - a.vendidos || a.id - b.id);
  for (const c of copoes.slice(0, 3)) {
    const pool = c.nota >= 800 ? NOTA.top : c.nota >= 600 ? NOTA.bom : c.nota >= 300 ? NOTA.meh : NOTA.ruim;
    fixas.push([preencher(tpl(pool), c), 'galera']);
  }
  // o PT (e quem foi)
  const emPT = copoes.filter((c) => c.pt);
  if (emPT.length) {
    fixas.push([preencher(tpl(PT), emPT[0]), 'pt']);
    soltas.push([preencher(tpl(PT.filter((t) => t.includes('{nome}'))), pegar(r, emPT)), 'pt']);
    fixas.push([tpl(GALERA_PT), 'galera']);
  }
  // a sexta e o DJ (só "tocou": o DJ nunca fala)
  const dj = n.sexta && n.dj ? DJS[n.dj - 1] : null;
  if (n.sexta) fixas.push([tpl(SEXTA), 'galera']);
  if (dj) {
    fixas.push([preencher(tpl(DJ), null, { dj: dj.nome, estilo: dj.estilo }), 'dj']);
    const curtiu = copoes.find((c) => dj.bases.includes(c.base));
    if (curtiu) soltas.push([preencher(tpl(DJ_BASE), curtiu, { dj: dj.nome, estilo: dj.estilo }), 'dj']);
  }
  // a galera
  if (!emPT.length && n.galera_delta >= 1) fixas.push([tpl(GALERA_MAIS), 'galera']);
  else if (!emPT.length && n.galera_delta <= -1) fixas.push([tpl(GALERA_MENOS), 'galera']);
  // vazio só quando não teve copão nenhum; os que saíram antes da nota venderam (e a galera reparou)
  if (!copoes.length) fixas.push([tpl(n.saiu_antes > 0 ? SAIU : VAZIO), 'galera']);
  else if (n.vendas < 1) fixas.push([tpl(POUCO), 'galera']);
  if (copoes.length && n.saiu_antes > 0) soltas.push([tpl(SAIU), 'galera']);
  if (n.fichas < 0) soltas.push([tpl(PREJUIZO), 'galera']);

  // as partes da nota de cada copão
  for (const c of copoes) {
    const rs = rotulos(c.base, c.mistura, c.extra);
    const nomes: [string, string][] = [
      [BASES[c.base - 1].nome, minusculo(MISTURAS[c.mistura - 1].nome)],
      [BASES[c.base - 1].nome, minusculo(EXTRAS[c.extra - 1].nome)],
      [MISTURAS[c.mistura - 1].nome, minusculo(EXTRAS[c.extra - 1].nome)],
    ];
    const pior = rs.indexOf(Math.min(...rs) as never);
    const melhor = rs.indexOf(Math.max(...rs) as never);
    if (rs[pior] <= 1) soltas.push([preencher(tpl(PAR_RUIM), c, { a: nomes[pior][0], b: nomes[pior][1] }), 'galera']);
    else if (rs[melhor] === 4) soltas.push([preencher(tpl(PAR_BOM), c, { a: nomes[melhor][0], b: nomes[melhor][1] }), 'galera']);
    const cb = custoBeneficio(c.base, c.tamanho, c.forca, c.preco);
    if (cb <= 60) soltas.push([preencher(tpl(CARO), c), 'galera']);
    else if (cb >= 220) soltas.push([preencher(tpl(BARATO), c), 'galera']);
    const d = c.forca - BASES[c.base - 1].ponto;
    if (d <= -2) soltas.push([preencher(tpl(FRACO), c), 'galera']);
    else if (d >= 2 && !c.pt) soltas.push([preencher(tpl(FORTE), c), 'galera']);
    else if (aguenta(c.forca, BASES[c.base - 1].ponto) >= 170) soltas.push([preencher(tpl(PONTO), c), 'galera']);
    const moda = c.nota - rs.reduce<number>((s, x) => s + PONTOS[x], 0) - cb - aguenta(c.forca, BASES[c.base - 1].ponto);
    if (moda >= 150) soltas.push([preencher(tpl(MODA2), c), 'galera']);
    else if (moda >= 75) soltas.push([preencher(tpl(MODA1), c), 'galera']);
    if (c.tamanho === 3) soltas.push([tpl(BALDE), 'galera']);
    if (r() < 0.5) soltas.push([preencher(tpl(EXTRA), c), 'galera']);
  }

  const escolhidas = [...fixas, ...embaralhar(r, soltas)].slice(0, total);
  const enche = embaralhar(r, [...ENCHE]);
  while (escolhidas.length < total) escolhidas.push([enche[escolhidas.length % enche.length], 'galera']);
  // sem repetir texto; a ordem embaralhada, e ninguém fala duas vezes seguidas
  const unicas = [...new Map(escolhidas.map((x) => [x[0], x])).values()];
  for (const t of enche) if (unicas.length < total && !unicas.some((u) => u[0] === t)) unicas.push([t, 'galera']);
  const ordem = embaralhar(r, unicas);
  let antes = '';
  return ordem.map(([texto, tipo]) => {
    let autor = pegar(r, GALERA);
    while (autor === antes) autor = pegar(r, GALERA);
    antes = autor;
    return { autor, texto: texto.charAt(0).toUpperCase() + texto.slice(1), tipo };
  });
}
