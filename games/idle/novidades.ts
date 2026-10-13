// Patch notes da Fellas Inc.: uma versão por entrega, da mais nova pra mais antiga. Entrega nova = uma entrada nova no
// começo da lista (id novo acende a bolinha na engrenagem de quem ainda não leu).
export type Novidade = { id: string; titulo: string; data: string; itens: string[] };

export const NOVIDADES: readonly Novidade[] = [
  {
    id: '2026-10-13-empilha',
    titulo: 'Oportunidades empilham',
    data: '2026-10-13',
    itens: [
      'Produção ×5 agora empilha: pegou duas, ×25. Três, ×125. Cada uma acaba no seu tempo.',
      'E multiplica com o Viralizou: ×5 com ×10 dá ×50. Dois de cada, ×2.500. Boa sorte pra quem tá olhando o placar.',
      'Próxima compra pela metade também empilha: guardou duas, as próximas 2 compras saem pela metade.',
    ],
  },
  {
    id: '2026-10-13-arvore',
    titulo: 'Árvore nova: Dourados e Horta',
    data: '2026-10-13',
    itens: [
      'Fechou o jogo? A empresa rende o tempo todo, sem limite de 8h. Pode sumir uma semana que o dinheiro tá lá.',
      'Por isso o ramo Tempo saiu e virou Dourados: eventos mais frequentes, mais tempo na tela, Investidor pagando o dobro e Viralizou durando mais.',
      'Quem já tinha nó do Tempo ficou com o nó do Dourados no mesmo lugar. Ninguém perdeu ponto.',
      'Ramo novo na ponta direita: Horta. Planta crescendo mais rápido, vivendo mais, cruzando mais, e o Morango com Pescoço aparecendo mais (ele tem pescoço sim).',
    ],
  },
  {
    id: '2026-10-12-conquistas',
    titulo: 'Conquistas sem filtro',
    data: '2026-10-12',
    itens: [
      'As conquistas ganharam textos novos. Ninguém pediu, ninguém vai gostar.',
      'O aviso de conquista agora aparece grandão no topo da tela. Toca nele pra ver no Legado.',
      'No PC, passar o mouse numa conquista mostra o que ela é, o que precisou fazer e quando você ganhou.',
      'A conquista do Toby Fox estava com o texto da Ana. Arrumado.',
    ],
  },
  {
    id: '2026-10-12-toby-fox',
    titulo: 'Toby Fox no PPP',
    data: '2026-10-12',
    itens: [
      'A Ana Mary B saiu do podcast. No lugar dela, o Toby Fox (ou o cachorro dele, ninguém confirmou).',
      'Chapter 5 ano que vem: com ele sentado, a produção sobe 2% por hora, até +40% em 20 h. Trocar ou tirar zera, e as melhorias ficam 10% mais caras.',
      'A conquista da Ana virou a do Toby: deixar ele 20 h sentado.',
    ],
  },
  {
    id: '2026-10-12-celular',
    titulo: 'Celular arrumado',
    data: '2026-10-12',
    itens: [
      'No celular a tela rola inteira de novo: a empresa, as portas dos minigames, a Caixinha e a Loja embaixo (as abas grudam no topo).',
      'As portas dos minigames viraram uma fileira só, do jeito que cabe na mão.',
      'Segurar o dedo não abre mais a caixinha de informação por cima das coisas. No PC ela continua no mouse.',
    ],
  },
  {
    id: '2026-10-12-telas-cheias',
    titulo: 'Bolsa e Horta de cara nova',
    data: '2026-10-12',
    itens: [
      'A Bolsa em tela cheia: as 8 empresas do lado, o gráfico grande com a linha do quanto você pagou, e comprar e vender embaixo.',
      'A Horta em tela cheia: a grade 6 × 6 inteira (os canteiros que ainda não abriram ficam com cadeado), o canteiro escolhido e as sementes do lado.',
      'O Terry e o Vini sentados aparecem do lado da Horta, com o que estão fazendo com ela.',
      'A tela inicial ficou mais enxuta: tudo cabe sem rolar, e a Loja fica mais larga em tela grande.',
    ],
  },
  {
    id: '2026-10-12-convidados',
    titulo: 'Convidados no PPP Podcast',
    data: '2026-10-12',
    itens: [
      'Gaveta nova na bancada: os Convidados. Abre com 1 PPP Podcast; o meio abre com 25 e o canto com 50.',
      '11 convidados, cada um com um bônus e um defeito. A cadeira da frente vale tudo, a do meio metade, a do canto um quarto.',
      'Trocar custa: são 3 trocas, e cada uma volta em 1 h. Tirar alguém é de graça.',
      'Tem convidado que mexe na Bolsa, na Horta, nos eventos e nas oportunidades. Passa o mouse (ou segura o dedo) pra ver.',
      'Gemaplys e MC V.V nunca sentam juntos. Ninguém sabe por quê.',
      'Tela inicial nova: cada minigame ganhou uma porta (com o resumo do que está rolando) e abre em tela cheia.',
      '11 conquistas novas do podcast.',
    ],
  },
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
