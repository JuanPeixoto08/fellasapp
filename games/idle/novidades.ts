// Patch notes da Fellas Inc.: uma versão por entrega, da mais nova pra mais antiga. Entrega nova = uma entrada nova no
// começo da lista (id novo acende a bolinha na engrenagem de quem ainda não leu).
export type Novidade = { id: string; titulo: string; data: string; itens: string[] };

export const NOVIDADES: readonly Novidade[] = [
  {
    id: '2026-10-12-oportunidades-sorte',
    titulo: 'Oportunidades na sorte',
    data: '2026-10-12',
    itens: [
      'As oportunidades agora vêm na sorte: o tipo e a hora de cada uma não seguem mais uma ordem.',
      'Continua uma a cada 10 minutos, e cada um tem a sua.',
    ],
  },
  {
    id: '2026-10-12-dicas',
    titulo: 'Caixinhas de informação',
    data: '2026-10-12',
    itens: [
      'Passa o mouse (ou segura o dedo) num gerador: mostra quanto cada um rende, quanto todos rendem e que fatia da sua produção é dele.',
      'Nas melhorias: o que ela faz de verdade, quanto soma agora e o preço em tempo de produção.',
      'No F$/s do topo: de onde vem sua produção, multiplicador por multiplicador. Nos contratos: quanto cada parte dá.',
    ],
  },
  {
    id: '2026-10-11-horta',
    titulo: 'Horta do Food truck',
    data: '2026-10-11',
    itens: [
      'Gaveta nova na bancada: a Horta. Abre com 1 Food truck e cresce com eles (até 6 × 6).',
      'Planta, espera crescer, e a planta madura dá bônus: produção, geradores e melhorias mais baratos.',
      'Duas vizinhas maduras às vezes cruzam e nasce uma espécie nova. Colhe pra liberar a semente.',
      'Planta velha morre. Dizem que onde ela morreu às vezes nasce um morango… com pescoço.',
      '11 conquistas novas da roça.',
    ],
  },
  {
    id: '2026-10-11-contratos',
    titulo: 'Contrato é contrato',
    data: '2026-10-11',
    itens: [
      'Vender a startup não cancela mais os contratos que você fez: eles seguem até vencer.',
      'Quem teve contrato cortado por uma venda ganhou ele de volta, até o fim original.',
    ],
  },
  {
    id: '2026-10-11-sorte',
    titulo: 'Sorte na tela',
    data: '2026-10-11',
    itens: [
      'De vez em quando aparece um evento na tela: pega antes que suma (12 s).',
      'Investidor apressado: 20 minutos de produção na hora.',
      'Promoção relâmpago: geradores e melhorias pela metade por 30 s.',
      'Viralizou: produção ×10 por 1 minuto. Pegou outro no meio? ×100. E não para por aí.',
      'As oportunidades agora ficam só na Caixinha.',
      'No PC, o som do evento toca mesmo com a aba em segundo plano: dá tempo de voltar e pegar.',
    ],
  },
  {
    id: '2026-10-11-som',
    titulo: 'Som na firma',
    data: '2026-10-11',
    itens: [
      'Música swing que cresce junto com a empresa: cada era tem a sua.',
      'Efeitos pra compra, venda, conquista, era nova, oportunidade e mais.',
      'Nas Configurações: volume da música, e efeitos e avisos que ligam e desligam separado.',
      'No PC a música continua tocando com outra janela ou aba por cima.',
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
