// Patch notes da Fellas Inc.: uma versão por entrega, da mais nova pra mais antiga. Entrega nova = uma entrada nova no
// começo da lista (id novo acende a bolinha na engrenagem de quem ainda não leu).
export type Novidade = { id: string; titulo: string; data: string; itens: string[] };

export const NOVIDADES: readonly Novidade[] = [
  {
    id: '2026-10-16-cupom-meia-max',
    titulo: 'Cupom e meia-preço no 10 e no Máx',
    data: '2026-10-16',
    itens: [
      'O Cupom de primeira compra agora conta por gerador: com 3 cupons, comprar 10 deixa 3 geradores 25% mais baratos e gasta os 3. O Máx já calcula assim quantos cabem.',
      'A Próxima compra pela metade vale a compra inteira, também no 10 e no Máx: o Máx compra o que cabe pela metade. Enquanto ela vale, os cupons ficam guardados.',
    ],
  },
  {
    id: '2026-10-15-eras-6-7',
    titulo: 'Eras 6 e 7: órbita e Lua',
    data: '2026-10-15',
    itens: [
      'Duas eras novas: Em órbita (era 6) e Lua (era 7), com 12 geradores. Do satélite que apaga as estrelas ao posto de gasolina lunar, passando por um HAL 9000 que não deixa você cancelar a assinatura.',
      'Cada gerador novo tem 8 melhorias, e cada era ganha 4 melhorias gerais.',
      'Melhorias de legado: os geradores das eras antigas ajudam a era nova. Quanto mais notebook da faculdade você tem, mais a órbita rende.',
      'Estratégias novas: Turismo espacial ou Satélites de internet na era 6; Mineração lunar ou Hotel na Lua na era 7.',
      'Eventos novos: Lixo espacial (desvie dos 3 destroços; cada um vale 10 minutos de produção) e "Houston, temos um problema" (conserte com silver tape e a produção fica ×4 por 2 minutos).',
      'Música de órgão nova nas duas eras e uma fanfarra conhecida na hora de sair da atmosfera.',
      'Os números agora vão até o centilhão, passando pelo googol.',
      '18 conquistas novas: uma pra cada gerador novo (ter 100), Órbita lotada, Condomínio lunar, Estação completa, Lua de luxo, Desviou de tudo e Silver tape resolve.',
    ],
  },
  {
    id: '2026-10-15-som-volta',
    titulo: 'O som não some mais',
    data: '2026-10-15',
    itens: [
      'O jogo tenta ligar o som assim que abre, sem esperar um clique. Aba que o navegador restaurou sozinho agora toca os dourados (quando o navegador deixa; se não deixar, um clique em qualquer lugar liga).',
      'Se o som parar sozinho, depois de o PC dormir, de trocar o fone ou de muito tempo com a aba no fundo, ele volta sem precisar recarregar a página.',
    ],
  },
  {
    id: '2026-10-15-dourados-caixinha',
    titulo: 'Dourados novos e uma Caixinha mais cheia',
    data: '2026-10-15',
    itens: [
      'Trend do TikTok: chovem moedinhas por 8 segundos. Cada uma que você pega é 1 minuto de produção, até 20.',
      'Bombou no LinkedIn: um dos seus 5 geradores que mais produzem rende ×30 por 1 minuto. O post de coach vem de brinde.',
      'Pix errado: fica com 30 minutos de produção ou devolve e ganha um dourado em dobro em até 2 minutos. Ninguém viu.',
      'Tigrinho: as 3 primeiras jogadas do dia sempre pagam. Depois, a casa paga 3 em cada 10. Só mais uma.',
      'Combo: pegue 3 dourados seguidos sem deixar nenhum sumir e a produção fica ×7 por 1 minuto.',
      'Cinco oportunidades novas na Caixinha: Chamar um dourado (guarda até 3 pra chamar quando quiser), Cupom de primeira compra (10 compras de gerador 25% mais baratas), Adubo de farmácia (a planta mais perto de amadurecer fica madura na hora), Cashback (toda compra devolve 30% por 2 minutos) e Informação privilegiada (espia o humor de uma empresa da Bolsa até ele mudar).',
      'Sem Horta ou sem Bolsa, o Adubo e a Informação viram 15 minutos de produção.',
      '6 conquistas novas: Dancinha do TikTok, Cidadão de bem, Só mais uma, C-C-C-Combo!, Primeira compra (de novo) e Volta pra conta.',
    ],
  },
  {
    id: '2026-10-15-placar-na-cena',
    titulo: 'Placar em cima da cena',
    data: '2026-10-15',
    itens: [
      'No PC, o dinheiro e o F$/s viraram um placar de jogo no canto da cena, com o Viralizou e a Promoção valendo logo embaixo. A era e o resto ficam numa faixa no pé da cena.',
      'A Caixinha mudou pro lado da cena, uma oportunidade embaixo da outra com o Pegar. As portas dos minigames ficaram sozinhas embaixo, maiores.',
    ],
  },
  {
    id: '2026-10-15-menos-roxo',
    titulo: 'Roxo só no que é pra apertar',
    data: '2026-10-15',
    itens: [
      'A aba aberta, a chave ligada e os botões de comprar da Bolsa largaram o roxo cheio. Agora o roxo só aparece no botão principal de cada tela, e dá pra achar de primeira.',
    ],
  },
  {
    id: '2026-10-15-quarto-inicio',
    titulo: 'O quarto das 3h06 ficou maior',
    data: '2026-10-15',
    itens: [
      'Antes de abrir o CNPJ, o quarto ocupa a tela e a pergunta vem numa caixa de diálogo de jogo, com a setinha piscando na escolha.',
    ],
  },
  {
    id: '2026-10-15-jogo-do-brasil-trava',
    titulo: 'Jogo do Brasil sem clique perdido',
    data: '2026-10-15',
    itens: [
      'Depois do primeiro gol, o resto da tela trava até o jogo acabar. Errou a bola? Não compra gerador nem abre nada sem querer.',
    ],
  },
  {
    id: '2026-10-14-eras-1-5',
    titulo: 'As eras 1 a 5 ganharam vida',
    data: '2026-10-14',
    itens: [
      'Cada gerador ganhou mais 3 melhorias, com 150, 200 e 300 unidades. Cada uma dobra o gerador.',
      'Eventos de era: de vez em quando a sua era apronta alguma. A mãe chama pro almoço, chega pacote da Shopee, cai uma reunião que podia ser um e-mail, o PC dá tela azul e tem Jogo do Brasil. O de cada era aparece quando você chega nela e continua depois.',
      'Marmita da mãe: produção ×3 por 3 minutos. Atualização instalada: melhorias 25% mais baratas por 2 minutos.',
      '15 conquistas novas: dos eventos, de ter 300 de cada gerador da era e de comprar todas as melhorias da era.',
      'O som de clicar e o de abrir e fechar ficaram mais suaves. Antes parecia que o botão dava choque.',
    ],
  },
  {
    id: '2026-10-14-copao-uma-prova',
    titulo: 'Copão: uma prova por vez',
    data: '2026-10-14',
    itens: [
      'A galera agora prova um copão por vez. Mandou provar, o botão mostra quanto falta pra nota (5 min) e destrava quando ela sai.',
      'Continua de graça e sem limite no dia.',
    ],
  },
  {
    id: '2026-10-14-bolsa-melhorias',
    titulo: 'Bolsa: melhorias pelo preço da tela',
    data: '2026-10-14',
    itens: [
      'Corretor e Escritório cobravam mais do que o botão mostrava (contavam os convidados) e davam "Valuation não cobre essa compra" mesmo com o F$ na mão. Agora custam o que está escrito no botão.',
    ],
  },
  {
    id: '2026-10-14-mapa-ritmo',
    titulo: 'Mapa do rolê mais rápido',
    data: '2026-10-14',
    itens: [
      'Camisetaria em minutos: o lote fica pronto em 2, 5 ou 10 min e vende em meia hora. Dá pra testar combinação até cansar os influencers. Sexta e sábado à noite a venda continua em dobro.',
      'A coleção que já estava rodando segue no horário antigo. As novas já saem no ritmo novo.',
      'Subir de nível na camisetaria ficou mais caro, porque agora dá pra lançar muito mais coleção por dia.',
      'Copão: botão Provar no montar. A galera prova a receita sem ir pro cardápio e a nota sai em 5 min, de graça, quantas vezes quiser. O caderninho anota os pares e a força, e a galera solta o que achou.',
      'Gostou da prova? Põe no cardápio direto dela. As vendas, o pódio e os desafios do copão continuam sendo coisa da noite, das 18h às 2h.',
    ],
  },
  {
    id: '2026-10-13-mapa-do-role',
    titulo: 'Mapa do rolê',
    data: '2026-10-13',
    itens: [
      'Abriu o Mapa do rolê: os lugares do rolê viram filiais da Fellas Inc. Cada um tem moeda, nível e um jeito próprio de render.',
      'Todo lugar tem marcos (bônus de produção na empresa toda), desafio da semana, pódio de sempre e um caderninho com o que você já descobriu.',
      'Camisetaria: monta a coleção (tema, estilo, peça, cor e foco), quatro influencers postam a nota e a procura decide se esgota ou encalha.',
      'Copão: monta o copão (base, mistura, extra, tamanho, força e preço) e o bar vende sozinho toda noite, das 18h às 2h. A nota sai quando ele fecha a primeira noite no cardápio, e no dia seguinte a galera comenta no chat.',
      'O preço de referência sobe com a base mais cara, a força e o tamanho; cobrar muito acima dela espanta a galera. Balde rende mais por venda, mas sai menos.',
      'Sexta é movimento em dobro com DJ: escolhe quem toca e os copões das bases certas vendem mais. Passou do ponto da força, alguém dá PT.',
      'O jantar é o próximo. Tá no forno.',
    ],
  },
  {
    id: '2026-10-13-somam',
    titulo: 'Os ×5 somam',
    data: '2026-10-13',
    itens: [
      'Ficou roubado demais: os ×5 das oportunidades agora somam em vez de multiplicar. Dois dão ×10, três dão ×15 (antes era ×25 e ×125).',
      'O Viralizou continua multiplicando por cima: dois Viralizou (×100) com dois ×5 (×10) dá ×1.000.',
    ],
  },
  {
    id: '2026-10-13-dobro',
    titulo: 'O dobro dobra e a Era 6',
    data: '2026-10-13',
    itens: [
      'Com Viralizar ou Xepa da feira ("rendem o dobro"), cada oportunidade conta como 2: o ×5 entra duas vezes (×10 de uma vez) e a metade guarda 2 compras. Com os dois juntos, conta como 4.',
      'Quem comprou o gerador 30 e foi pra órbita agora aparece como Era 6 · Em órbita, do lado da cena e no placar.',
    ],
  },
  {
    id: '2026-10-13-empilha',
    titulo: 'Oportunidades empilham',
    data: '2026-10-13',
    itens: [
      'Produção ×5 agora empilha: pegou duas, ×10. Três, ×15. Cada uma acaba no seu tempo.',
      'E o Viralizou multiplica por cima: ×5 com ×10 dá ×50. Dois de cada, ×1.000.',
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
