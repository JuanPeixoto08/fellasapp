// Patch notes da Fellas Inc.: uma versão por entrega, da mais nova pra mais antiga. Entrega nova = uma entrada nova no
// começo da lista (id novo acende a bolinha na engrenagem de quem ainda não leu).
export type Novidade = { id: string; titulo: string; data: string; itens: string[] };

export const NOVIDADES: readonly Novidade[] = [
  {
    id: '2026-10-11-som',
    titulo: 'Som na firma',
    data: '2026-10-11',
    itens: [
      'Música swing que cresce junto com a empresa: cada era tem a sua.',
      'Efeitos pra compra, venda, conquista, era nova, oportunidade e mais.',
      'Nas Configurações: volume da música, e efeitos e avisos que ligam e desligam separado.',
    ],
  },
  {
    id: '2026-10-11-venda-oportunidades',
    titulo: 'Venda com cota nova',
    data: '2026-10-11',
    itens: ['Vender a startup agora recomeça a cota de oportunidades do dia. A empresa nova não precisa esperar até amanhã.'],
  },
  {
    id: '2026-10-11-bolsa',
    titulo: 'Bolsa da Faria Lima',
    data: '2026-10-11',
    itens: [
      'Gaveta nova na bancada: a Bolsa. Abre com 1 Grupo de trader.',
      '8 empresas pra investir, do Pastel do Zé à Cripto do Primo. Preço novo todo minuto, igual pra todo mundo.',
      'Empresa na zona de risco pode quebrar. Aí suas ações viram pó.',
      'Cada empresa da Bolsa é ligada a um gerador: quanto mais dele, mais ações você pode ter.',
      'Corretor e Escritório: corretagem mais barata e mais ações por empresa.',
      'No PC a tela cresce junto com a janela. Monitor grande sem espaço sobrando.',
      'Engrenagem no topo: som, seu visual e estas notas.',
    ],
  },
  {
    id: '2026-10-11-cara-nova',
    titulo: 'Cara nova',
    data: '2026-10-11',
    itens: [
      'Visual pixel: letra nova, botões roxos e cantos de pixel.',
      'Quatro abas: Loja, Gente, Placar e Legado.',
      'No PC, a empresa e a bancada de um lado e o painel do outro.',
      'Árvore de habilidades em tela cheia, e as conquistas viraram uma grade de ícones.',
    ],
  },
  {
    id: '2026-10-11-legado',
    titulo: 'Legado',
    data: '2026-10-11',
    itens: [
      'Vender a startup: recomeça do zero e leva pontos de prestígio.',
      'Árvore de habilidades pra gastar os pontos.',
      '72 conquistas, cada uma com um pouco mais de produção.',
      'Os pontos de prestígio aparecem no placar.',
    ],
  },
  {
    id: '2026-10-10-gente',
    titulo: 'Gente',
    data: '2026-10-10',
    itens: [
      'Monte seu boneco: pele, cabelo, roupa e o que vai na cabeça.',
      'Contrate os fellas por 7 dias e veja a galera trabalhando na sua cena.',
      'Ser contratado também rende produção.',
    ],
  },
  {
    id: '2026-10-10-cnpj',
    titulo: 'Abriu o CNPJ',
    data: '2026-10-10',
    itens: [
      'A Fellas Inc. abriu: do notebook da faculdade até virar unicórnio.',
      'Geradores, melhorias e oportunidades passando na cena.',
      'A empresa nunca zera sozinha.',
      'Toda segunda sai a foto do placar, e o 1º ganha o selo de unicórnio.',
    ],
  },
];

/** Tem versão que a pessoa ainda não leu? (vista = id da última lida no aparelho) */
export const temNovidade = (vista: string | null) => vista !== NOVIDADES[0].id;

/** '2026-10-11' → '11/10/2026' */
export const dataNovidade = (iso: string) => iso.split('-').reverse().join('/');
