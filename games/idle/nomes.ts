// Textos da Fellas Inc.: dá pra trocar nomes e frases à vontade (a lógica usa só os ids e os números).
// Depois de mudar, crie uma migração nova do catálogo (ver o cabeçalho gerado em catalogo.ts).

/** Balanceamento das eras 6–7 que a simulação ajustou (simulacao.test.ts, "ritmo das eras 6 e 7"): os multiplicadores
 *  das gerais, o p do legado e o ×N das estratégias de gerador. */
const GERAL_6 = [1.3, 1.3, 1.35, 1.35] as const;
const GERAL_7 = [1.35, 1.35, 1.4, 1.4] as const;
const LEGADO_P = 0.0005;
const EST_6_GEN = 2;
const EST_7_GEN = 2;

/** Os geradores, na ordem. A cada 6 começa uma era (e uma cena). */
export const GERADORES: readonly string[] = [
  'Você, no notebook da faculdade', 'Post motivacional no LinkedIn', 'Planilha no Excel',
  'Vendendo pra tia no grupo da família', 'Freela no Fiverr', 'Live na Twitch',
  'Estagiário', 'Impressora 3D', 'Grupo de vendas no zap', 'Dropshipping', 'Food truck', 'Loja no Mercado Livre',
  'PPP Podcast', 'Influencer parceiro', 'App na App Store', 'Curso online', 'Agência de marketing', 'Coworking próprio',
  'Grupo de trader', 'Investidor anjo', 'Fazenda de servidores', 'Rodada série A', 'Laboratório de inovação',
  'Fusão com a concorrência',
  'Rolê patrocinado', 'Comprar um time do Brasileirão', 'Ilha particular', 'Filial em Dubai', 'IPO na bolsa',
  'Foguete pra Marte',
  // era 6 · Em órbita (entrega 1 das eras 6–12)
  'Constelação de satélites', 'Voo de 11 minutos com famoso', 'Hotel em órbita', 'HAL 9000 gerenciando a estação',
  'Ferro-velho orbital', 'Equipe de perfuração do Armageddon',
  // era 7 · Lua
  'Posto de gasolina lunar', 'Estúdio da teoria da conspiração', 'Fazenda de queijo lunar', 'Mina de hélio-3 com clone',
  'Raio encolhedor do Gru', 'Base no lado escuro da Lua',
];

/** As 8 melhorias de cada gerador (níveis 1, 10, 25, 50, 100, 150, 200 e 300 unidades); cada uma dobra o gerador. */
export const MELHORIAS_GERADOR: readonly (readonly [string, string, string, string, string, string, string, string])[] = [
  ['Carregador original', 'Wi-Fi da biblioteca', 'Segundo monitor', 'Café de máquina', 'Noite virada', 'ChatGPT fazendo o TCC', 'Starlink no quarto', 'Aviso de despejo em 5 dias'],
  ['Foto de terno', 'Textão com emoji', 'Selo de "open to work"', 'Post às 7h da manhã', 'Viralizou no feed', 'Carrossel de 10 slides', 'Selfie chorando depois do layoff', 'Selo de Top Voice'],
  ['PROCV', 'Tabela dinâmica', 'Macro que ninguém entende', 'Gráfico colorido', 'Planilha que ninguém mexe', 'PROCX', 'Copilot na planilha', 'Planilha que roda Doom'],
  ['Áudio de 3 minutos', 'Figurinha de bom dia', 'Desconto de família', 'Fiado da tia', 'Tia influencer', 'Encaminhada com frequência', 'Corrente com link de pagamento', 'Ceia de Natal com maquininha'],
  ['Cinco estrelas', 'Entrega no mesmo dia', 'Cliente gringo', 'Pacote premium', 'Top Rated', 'Cliente que paga em "visibilidade"', 'Logo de 5 dólares em 24 h', 'Contrato em dólar'],
  ['Microfone bom', 'Overlay animado', 'Raid surpresa', 'Sub de 1 real', 'Live de 12 horas', 'Emote próprio', 'Doação com voz de robô', 'Subathon de 30 dias'],
  ['Crachá com foto', 'Vale-transporte', 'Cafeteira só dele', 'Hora extra (não paga)', 'Efetivação (talvez)', 'Vale-refeição de F$ 12', 'Mesa perto da janela', 'Estagiário do ano (sem vínculo)'],
  ['Filamento roxo', 'Bico novo', 'Imprimindo a noite toda', 'Segunda impressora', 'Fazenda de impressoras', 'Imprimiu a peça que quebrou', 'Action figure do chefe', 'Imprimiu uma casa'],
  ['Lista de transmissão', 'Mensagem fixada', 'Status com preço', 'Grupo 2 (lotado)', 'Grupo 3 (VIP)', 'Comunidade com 50 grupos', 'Canal com selo verde', 'Bot que manda bom dia'],
  ['Fornecedor que responde', 'Frete em 40 dias', 'Anúncio no story', 'Loja com domínio próprio', 'Fornecedor nacional', 'Remessa Conforme', 'Fornecedor da Temu', 'Galpão no Paraguai'],
  ['Molho da casa', 'Ponto na orla', 'Cardápio no QR', 'Segundo truck', 'Fila dobrando a esquina', 'Smash burger', 'Fila por causa do TikTok', 'Ponto fixo no estádio'],
  ['Frete grátis', 'Medalha amarela', 'Medalha verde', 'MercadoLíder', 'Full', 'Anúncio patrocinado', 'Chega amanhã', 'Avião de carga próprio'],
  ['Microfone condensador', 'Corte pro TikTok', 'Convidado famoso', 'Episódio de 4 horas', 'Patrocínio de energético', 'Corte com legenda amarela', 'Mesa com 7 microfones', 'Mensagem subliminar no episódio'],
  ['Publi com cupom', 'Arroba marcado', 'Recebidos', 'Stories de 15 em 15', 'Collab', 'Publi de bet', 'Recebido de carro', 'Depoimento na CPI'],
  ['Ícone bonito', 'Modo escuro', 'Avaliação 4,9', 'Notificação na hora certa', 'App do Ano', 'Pop-up pedindo 5 estrelas', 'Assinatura sem botão de cancelar', 'Termos de uso de 90 páginas'],
  ['Aula bônus', 'Certificado com selo', 'Comunidade no Discord', 'Mentoria em grupo', 'Turma esgotada', 'Método com nome em inglês', 'Imersão num resort', 'Mentoria de F$ 50 mil'],
  ['Mídia kit', 'Cliente fixo', 'Reels toda semana', 'Prêmio de agência', 'Conta grande', 'Trend da dancinha', 'Briefing em áudio de 7 min', 'Comercial no intervalo do BBB'],
  ['Café liberado', 'Sala de reunião de vidro', 'Pufe colorido', 'Lista de espera', 'Segunda unidade', 'Kombucha na torneira', 'Cabine de ligação', 'Endereço na Faria Lima'],
  ['Gráfico de velas', 'Alerta no celular', 'Stop no lugar certo', 'Bot de sinais', 'Mesa proprietária', 'Tigrinho no intervalo', 'Print de lucro editado', 'Corretora nas Bahamas'],
  ['Pitch de 3 minutos', 'Café com investidor', 'Cheque assinado', 'Investidor que indica outro', 'Conselho consultivo', 'Term sheet no guardanapo', 'Anjo do Shark Tank', 'Anjo com jatinho'],
  ['Ar-condicionado', 'Nobreak', 'Rack novo', 'Refrigeração líquida', 'Data center próprio', 'GPU com fila de espera', 'Servidor na Islândia', 'Data center no fundo do mar'],
  ['Deck bonito', 'Valuation pré-money', 'Lead investor', 'Rodada estendida', 'Série B à vista', 'Down round disfarçado', 'Valuation de unicórnio', 'Cheque do SoftBank'],
  ['Post-its na parede', 'Design thinking', 'Hackathon', 'Patente registrada', 'Protótipo que funciona', 'Óculos de realidade virtual', 'Metaverso (abandonado)', 'IA que faz os slides'],
  ['Due diligence', 'Aperto de mão', 'Sinergias (de verdade)', 'Logo novo', 'Monopólio (quase)', 'Aprovado pelo Cade', 'Demissão em massa por vídeo', 'Nome novo de três letras'],
  ['Pulseira VIP', 'Open bar', 'DJ famoso', 'Camarote', 'Line-up internacional', 'Copão de 2 litros', 'Água a F$ 25', 'Festival que vira documentário'],
  ['Virar SAF', 'Contratar técnico português', 'Patrocínio master', 'Estádio reformado', 'Título do Brasileirão', 'Bet na camisa', 'Craque de volta aos 36', 'Libertadores'],
  ['Píer', 'Heliponto', 'Resort', 'Festa na ilha', 'Ilha vizinha', 'Gerador a diesel', 'Bunker embaixo da piscina', 'Bunker pra ascender'],
  ['Escritório no arranha-céu', 'Carro de luxo da firma', 'Filial em Portugal', 'Parceiro xeique', 'Torre própria', 'Chocolate de Dubai', 'Lamborghini da polícia', 'Apartamento na Palm'],
  ['Tocar o sino', 'Ação em alta', 'Dividendos', 'Índice da bolsa', 'Bilionário na capa', 'Circuit breaker', 'Ação meme', 'Recompra de ações'],
  ['Motor reutilizável', 'Lançamento sem explodir', 'Estação em órbita', 'Base na Lua', 'Colônia em Marte', 'Foguete pego com hashi', 'Carro esportivo em órbita', 'Passagem só de ida'],
  ['Primeiro lançamento', 'Trenzinho de luzes no céu', 'Antena de pizza', 'Plano família interplanetário', 'Astrônomo reclamando', 'Mil satélites por mês', 'Internet no avião', 'Céu com mais satélite que estrela'],
  ['Macacão com logo', 'Cantora pop a bordo', 'Vídeo flutuando com a água', 'Champanhe sem gravidade', 'Lista de espera de bilionário', 'Capitão de série de TV a bordo', 'Podcast gravado em órbita', 'Ingresso mais caro que um apartamento'],
  ['Valsa do Danúbio Azul na acoplagem', 'Airbnb na estação espacial', 'Café da manhã em tubinho', 'Vista pra Terra (taxa extra)', 'Videofone de 1,70 o minuto', 'Spa de microgravidade', 'Suíte com janela redonda', 'Hilton da Odisseia'],
  ['Olho vermelho na parede', 'Osso jogado pro alto', 'Leitura labial', 'Xadrez imbatível', '"Desculpe, Dave"', 'Porta da cápsula trancada', 'Módulo de memória extra', 'Daisy, Daisy'],
  ['Rede de pegar destroço', 'Parafuso perdido de 1965', 'Luva de astronauta achada', 'Satélite soviético de segunda mão', 'Braço robótico', 'Guindaste orbital', 'Ferro-velho com selo ISO', 'Reciclagem de estação inteira'],
  ['Sonda de petróleo', 'Briefing de regata na agência espacial', 'Bomba nuclear de brinde', 'Rock farofa no rádio', 'Biscoito de bichinho', 'Broca nova (a velha travou)', 'Despedida no asteroide', 'Asteroide partido ao meio'],
  ['Pegada na poeira', 'Bandeira que não balança', 'Conveniência 24 h (o dia lunar dura 14)', 'Gasolina de hélio', 'Pão de queijo liofilizado', 'Calibrador de pneu de jipe lunar', 'Frentista de traje', 'Posto com bandeira própria'],
  ['Holofote que faz sombra errada', 'Cenário de areia cinza', 'Bandeira com ventilador', 'Fio de pendurar astronauta', 'Diretor perfeccionista contratado', 'Documentário no YouTube', 'Fórum de terraplanista', 'Pôster "Foi tudo gravado aqui"'],
  ['Faca de queijo espacial', 'Bolacha de água e sal', 'Queijo da cratera', 'Cachorro no comando', 'Foguete de garagem', 'Curado no vácuo', 'Meia-cura de 4 bilhões de anos', 'Exportação pra Minas'],
  ['Contrato de 3 anos', 'Robô com carinha na tela', 'Mensagem gravada da família', 'Clone de reserva', 'Clone que descobriu', 'Antena de interferência', 'Gaveta com 50 clones', 'Fusão nuclear limpa'],
  ['Minion de capacete', 'Banana espacial', 'Foguete roubado', 'Lua no bolso', 'Vilão concorrente', 'Empréstimo do Banco do Mal', 'Três meninas adotadas', 'Lua de volta (com juros)'],
  ['Prisma na entrada', 'Vinil da banda', 'Robô gigante escondido', 'Sinal sem resposta', 'Lado escuro (que nem é escuro)', 'Hangar de nave secreta', 'Laser apontado pra Terra', 'Eclipse particular'],
];

/** A frase de cada gerador que tem uma (os das eras 6 em diante): aparece na caixinha e na Loja. Só da página. */
export const FRASES_GERADOR: Readonly<Record<number, string>> = {
  31: 'Internet no meio do nada, e nenhuma estrela visível no céu.',
  32: 'Onze minutos de voo e três horas de vídeo sobre como mudou a sua vida.',
  33: 'Diária em dólar, vista de graça, gravidade cobrada à parte.',
  34: 'Desculpe, Dave. Receio que não posso cancelar sua assinatura.',
  35: 'Tudo que a humanidade jogou pra cima, agora com nota fiscal.',
  36: 'Treinar astronauta pra furar dava mais trabalho. Ninguém perguntou.',
  37: 'Aceita cartão, Pix e pedra lunar. Calibragem grátis.',
  38: 'Dizem que foi tudo gravado aqui. A gente só aluga o estúdio.',
  39: 'Todo mundo sabia que a Lua era de queijo. Faltava alguém vender.',
  40: 'Contrato de três anos. Você vai renovar. Você sempre renova.',
  41: 'Roubar a Lua deu trabalho. Alugar ela de volta dá lucro.',
  42: 'Escuro só no nome. O aluguel é bem iluminado.',
};

/** Melhorias gerais: 4 por era, +% em toda a produção. */
export const GERAIS: readonly { nome: string; frase: string; mult: number; era: number }[] = [
  { era: 1, mult: 1.05, nome: 'Café coado na hora', frase: 'Ninguém trabalha sem café.' },
  { era: 1, mult: 1.05, nome: 'Wi-Fi do vizinho', frase: 'A senha era 12345678.' },
  { era: 1, mult: 1.1, nome: 'Cadeira gamer', frase: 'As costas agradecem.' },
  { era: 1, mult: 1.1, nome: 'Fone com cancelamento de ruído', frase: 'Foco total, mundo no mudo.' },
  { era: 2, mult: 1.1, nome: 'Quadro branco', frase: 'Agora o plano tem setas.' },
  { era: 2, mult: 1.1, nome: 'Pizza na sexta', frase: 'Moral da equipe lá em cima.' },
  { era: 2, mult: 1.15, nome: 'Extensão de 10 tomadas', frase: 'Tudo ligado ao mesmo tempo.' },
  { era: 2, mult: 1.15, nome: 'Ar-condicionado na garagem', frase: 'Calor vencido.' },
  { era: 3, mult: 1.15, nome: 'Plano de saúde', frase: 'Benefício de empresa grande.' },
  { era: 3, mult: 1.15, nome: 'Day off no aniversário', frase: 'Parabéns, volta amanhã.' },
  { era: 3, mult: 1.2, nome: 'Happy hour pago', frase: 'A firma paga a primeira rodada.' },
  { era: 3, mult: 1.2, nome: 'Logo em neon', frase: 'Foto pro LinkedIn garantida.' },
  { era: 4, mult: 1.2, nome: 'Escorregador no escritório', frase: 'Reunião acaba mais rápido.' },
  { era: 4, mult: 1.2, nome: 'Sala de jogos', frase: 'Pingue-pongue também é networking.' },
  { era: 4, mult: 1.25, nome: 'Chef na cozinha', frase: 'Almoço que vira post.' },
  { era: 4, mult: 1.25, nome: 'Consultoria cara', frase: 'Slides lindos, conselho óbvio.' },
  { era: 5, mult: 1.25, nome: 'Jatinho da firma', frase: 'Reunião em outro estado antes do almoço.' },
  { era: 5, mult: 1.25, nome: 'Reunião no iate', frase: 'Pauta: o pôr do sol.' },
  { era: 5, mult: 1.3, nome: 'Cultura de dono', frase: 'Todo mundo pensa como sócio.' },
  { era: 5, mult: 1.3, nome: 'Lenda do mercado', frase: 'Tem até documentário sobre você.' },
  { era: 6, mult: GERAL_6[0], nome: 'Lançamento transmitido ao vivo', frase: 'Dez milhões assistindo a contagem.' },
  { era: 6, mult: GERAL_6[1], nome: 'Foguete que pousa de ré', frase: 'Reutilizável, e ainda estaciona sozinho.' },
  { era: 6, mult: GERAL_6[2], nome: 'Contagem regressiva com patrocínio', frase: 'Dez, nove, oferecimento…' },
  { era: 6, mult: GERAL_6[3], nome: 'Selfie do espaço', frase: 'A Terra inteira no fundo e você no meio.' },
  { era: 7, mult: GERAL_7[0], nome: 'Pequeno passo', frase: 'Um salto gigante pro faturamento.' },
  { era: 7, mult: GERAL_7[1], nome: 'Telescópio apontado pra você', frase: 'Lá de baixo dá pra ver o seu logo.' },
  { era: 7, mult: GERAL_7[2], nome: 'Trem-bala lunar', frase: 'Do Mar da Tranquilidade ao escritório em 4 min.' },
  { era: 7, mult: GERAL_7[3], nome: 'Lua cheia de clientes', frase: 'Toda lua cheia é Black Friday.' },
];

/** Legado (eras 6+): cada unidade de gerador da era `fonteEra` que você tem dá +porUnidade nos geradores da era
 *  `alvoEra`. Liberado ao chegar na era alvo. Ids 3001 em diante, na ordem. */
export const LEGADO: readonly { nome: string; fonteEra: number; alvoEra: number; porUnidade: number }[] = [
  { alvoEra: 6, fonteEra: 1, porUnidade: LEGADO_P, nome: 'O notebook da faculdade foi pro espaço' },
  { alvoEra: 6, fonteEra: 2, porUnidade: LEGADO_P, nome: 'A garagem virou hangar' },
  { alvoEra: 6, fonteEra: 3, porUnidade: LEGADO_P, nome: 'Escritório com gravidade zero' },
  { alvoEra: 6, fonteEra: 4, porUnidade: LEGADO_P, nome: 'O andar inteiro em órbita' },
  { alvoEra: 6, fonteEra: 5, porUnidade: LEGADO_P, nome: 'A sede virou base de lançamento' },
  { alvoEra: 7, fonteEra: 1, porUnidade: LEGADO_P, nome: 'Wi-Fi da biblioteca chega na Lua' },
  { alvoEra: 7, fonteEra: 2, porUnidade: LEGADO_P, nome: 'Food truck lunar' },
  { alvoEra: 7, fonteEra: 3, porUnidade: LEGADO_P, nome: 'Podcast gravado na cratera' },
  { alvoEra: 7, fonteEra: 4, porUnidade: LEGADO_P, nome: 'Trader que opera da Lua' },
  { alvoEra: 7, fonteEra: 5, porUnidade: LEGADO_P, nome: 'IPO na Bolsa Lunar' },
  { alvoEra: 7, fonteEra: 6, porUnidade: LEGADO_P, nome: 'Satélite de retransmissão' },
];

/** Sinergias: cada unidade da fonte dá +porUnidade no alvo. */
export const SINERGIAS: readonly { nome: string; fonte: number; alvo: number; porUnidade: number }[] = [
  { fonte: 1, alvo: 2, porUnidade: 0.01, nome: 'Post escrito no notebook' },
  { fonte: 2, alvo: 3, porUnidade: 0.01, nome: 'Planilha de engajamento' },
  { fonte: 3, alvo: 4, porUnidade: 0.01, nome: 'Tabela de preços pra família' },
  { fonte: 4, alvo: 5, porUnidade: 0.01, nome: 'Tia indica freela' },
  { fonte: 5, alvo: 6, porUnidade: 0.01, nome: 'Cliente assiste a live' },
  { fonte: 6, alvo: 7, porUnidade: 0.005, nome: 'Live contrata estagiário' },
  { fonte: 7, alvo: 8, porUnidade: 0.01, nome: 'Estagiário opera a impressora' },
  { fonte: 8, alvo: 9, porUnidade: 0.01, nome: 'Foto do produto no zap' },
  { fonte: 9, alvo: 10, porUnidade: 0.01, nome: 'Zap vira loja' },
  { fonte: 10, alvo: 11, porUnidade: 0.01, nome: 'Molho importado' },
  { fonte: 11, alvo: 12, porUnidade: 0.01, nome: 'Marmita no Mercado Livre' },
  { fonte: 12, alvo: 13, porUnidade: 0.005, nome: 'Vendedor vai pro PPP' },
  { fonte: 13, alvo: 14, porUnidade: 0.01, nome: 'Influencer no PPP' },
  { fonte: 14, alvo: 15, porUnidade: 0.01, nome: 'Cupom do app' },
  { fonte: 15, alvo: 16, porUnidade: 0.01, nome: 'Curso de como fazer app' },
  { fonte: 16, alvo: 17, porUnidade: 0.01, nome: 'Aluno vira cliente' },
  { fonte: 17, alvo: 18, porUnidade: 0.01, nome: 'Agência no coworking' },
  { fonte: 18, alvo: 19, porUnidade: 0.005, nome: 'Coworking de traders' },
  { fonte: 19, alvo: 20, porUnidade: 0.01, nome: 'Trader apresenta investidor' },
  { fonte: 20, alvo: 21, porUnidade: 0.01, nome: 'Anjo paga os servidores' },
  { fonte: 21, alvo: 22, porUnidade: 0.01, nome: 'Métricas pro deck' },
  { fonte: 22, alvo: 23, porUnidade: 0.01, nome: 'Rodada banca o laboratório' },
  { fonte: 23, alvo: 24, porUnidade: 0.01, nome: 'Inovação compra a concorrente' },
  { fonte: 24, alvo: 25, porUnidade: 0.005, nome: 'Fusão dá festa' },
  { fonte: 25, alvo: 26, porUnidade: 0.01, nome: 'Rolê no estádio' },
  { fonte: 26, alvo: 27, porUnidade: 0.01, nome: 'Time treina na ilha' },
  { fonte: 27, alvo: 28, porUnidade: 0.01, nome: 'Ilha com voo pra Dubai' },
  { fonte: 28, alvo: 29, porUnidade: 0.01, nome: 'Dubai na bolsa' },
  { fonte: 29, alvo: 30, porUnidade: 0.01, nome: 'IPO paga o foguete' },
  { fonte: 1, alvo: 30, porUnidade: 0.01, nome: 'Do quarto pra Marte' },
];

export type EstrategiaTexto = {
  era: number; opcao: number; nome: string; frase: string;
  ativa?: boolean; requer?: 'contratos' | 'lugares';
  genDe?: number; genAte?: number; genMult?: number; prodMult?: number; custoMult?: number;
  oppBonusMult?: number; oppExtra?: number; oppSegundos?: number; porGeradorDistinto?: number;
  sociais?: Record<string, number>;
};

/** Estratégias: 3 por era (2 a 5) e 2 nas eras 6 e 7. `ativa: false` = depende de algo que ainda não chegou. */
export const ESTRATEGIAS: readonly EstrategiaTexto[] = [
  { era: 2, opcao: 0, nome: 'Bootstrapping', frase: 'Cresce com o que tem: os geradores do 1 ao 12 rendem 50% a mais.', genDe: 1, genAte: 12, genMult: 1.5 },
  { era: 2, opcao: 1, nome: 'Queimar caixa', frase: 'Tudo custa 25% a mais, mas a produção sobe 60%.', custoMult: 1.25, prodMult: 1.6 },
  { era: 2, opcao: 2, nome: 'Networking', frase: 'Contratos valem o dobro.', requer: 'contratos', sociais: { contratoEfeitoMult: 2 } },
  { era: 3, opcao: 0, nome: 'Viralizar', frase: 'Oportunidades rendem o dobro e o limite do dia sobe 3.', oppBonusMult: 2, oppExtra: 3 },
  { era: 3, opcao: 1, nome: 'Foco no produto', frase: 'Os geradores do 13 ao 18 rendem o dobro.', genDe: 13, genAte: 18, genMult: 2 },
  { era: 3, opcao: 2, nome: 'Marca forte', frase: '+5% de produção por lugar aberto no Mapa do rolê.', requer: 'lugares', sociais: { porLugar: 0.05 } },
  { era: 4, opcao: 0, nome: 'Abrir capital', frase: 'Produção +30%, mas contratar custa o dobro.', prodMult: 1.3, sociais: { contratoCustoMult: 2 } },
  { era: 4, opcao: 1, nome: 'Monopólio', frase: 'Os marcos dos seus lugares valem o dobro.', requer: 'lugares', sociais: { marcosMult: 2 } },
  { era: 4, opcao: 2, nome: 'Cultura de startup', frase: '+15% por contratado, e seus contratados ganham o triplo.', requer: 'contratos', sociais: { porContratado: 0.15, empregadoMult: 3 } },
  { era: 5, opcao: 0, nome: 'Expansão global', frase: 'Os geradores do 25 ao 30 rendem o dobro.', genDe: 25, genAte: 30, genMult: 2 },
  { era: 5, opcao: 1, nome: 'Holding', frase: '+3% de produção por gerador diferente que você tem.', porGeradorDistinto: 0.03 },
  { era: 5, opcao: 2, nome: 'Rolê eterno', frase: 'Oportunidades ficam 30 segundos na tela e o limite do dia sobe 5.', oppSegundos: 30, oppExtra: 5 },
  { era: 6, opcao: 0, nome: 'Turismo espacial', frase: 'Os geradores do 31 ao 36 rendem o dobro.', genDe: 31, genAte: 36, genMult: EST_6_GEN },
  { era: 6, opcao: 1, nome: 'Satélites de internet', frase: 'Oportunidades em F$ rendem 50% a mais, as outras valem em dobro, e o limite do dia sobe 2.', oppBonusMult: 1.5, oppExtra: 2 },
  { era: 7, opcao: 0, nome: 'Mineração lunar', frase: 'Os geradores do 37 ao 42 rendem o dobro.', genDe: 37, genAte: 42, genMult: EST_7_GEN },
  { era: 7, opcao: 1, nome: 'Hotel na Lua', frase: 'Geradores e melhorias custam 25% menos.', custoMult: 0.75 },
];

/** Nome de cada era (é a cena). */
export const ERAS: readonly string[] = ['Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede', 'Em órbita', 'Lua'];

/** Cargos sorteados ao contratar (o banco guarda o texto no contrato). Minúsculo: entra no meio da frase
 *  ("te contratou como sócio de fachada"). */
export const CARGOS: readonly string[] = [
  'estagiário', 'sócio de fachada', 'coach de produtividade', 'CEO de nada', 'head de vibes', 'diretor de memes',
  'analista de café', 'gerente do grupo do zap', 'consultor de LinkedIn', 'growth hacker', 'especialista em PowerPoint',
  'VP de happy hour', 'embaixador da marca', 'trainee eterno', 'estrategista de rolê', 'assessor de assuntos aleatórios',
];

/** Opções do editor de personagem, na ordem dos números guardados em idle_avatar (e das linhas do kit). */
export const VISUAL_NOMES = {
  pele: ['Pele 1', 'Pele 2', 'Pele 3', 'Pele 4', 'Pele 5', 'Pele 6'],
  cabelo: ['Curto', 'Raspado', 'Cacheado', 'Black power', 'Comprido', 'De lado'],
  cor_cabelo: ['Preto', 'Castanho', 'Loiro', 'Ruivo', 'Grisalho', 'Roxo', 'Azul', 'Rosa'],
  roupa: ['Moletom', 'Camiseta', 'Camisa social', 'Jaqueta'],
  cor_roupa: ['Preto', 'Branco', 'Cinza', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Roxo', 'Rosa'],
  acessorio: ['Nada', 'Boné', 'Fone', 'Óculos', 'Gorro', 'Bandana'],
  cor_acessorio: ['Preto', 'Branco', 'Cinza', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Roxo', 'Rosa'],
} as const;

/** Tipos de condição das conquistas. As "de estado" o banco confere em idle_check_conquistas (no idle_save, o último
 *  passo de toda função que muda o jogo); as "de evento" (aura_negativa, sigma, jaula, madrugada, unicornio) quem vê o
 *  evento dá na hora (idle_ganhar). */
export type TipoConquista =
  | 'gerador' | 'gerador_exato' | 'taxa' | 'era' | 'melhoria' | 'melhorias' | 'oportunidades' | 'vendas'
  | 'contratei' | 'contratado' | 'estrategia_era' | 'estrategia_todas' | 'aura' | 'brainrot'
  | 'aura_negativa' | 'sigma' | 'jaula' | 'madrugada' | 'unicornio'
  // horta (0048): de estado (contadores e coleção) e de evento (plantou/colheu/descobriu/brotou)
  | 'horta_plantou' | 'horta_colheu' | 'horta_morreu' | 'horta_colecao'
  | 'horta_pix' | 'horta_mandioca' | 'horta_coentro' | 'horta_inhame' | 'horta_abacate' | 'horta_morango'
  // convidados (0051): de estado (vistos, Kojima, derrubada, Toby) e de evento (sentou, mesa, CR, FGC, HL3, mesma pessoa, dia de oportunidades)
  | 'conv_sentou' | 'conv_mesa' | 'conv_vistos' | 'conv_cr' | 'conv_fgc' | 'conv_kojima' | 'conv_hl3' | 'conv_derrubada'
  | 'conv_toby' | 'opp_dia' | 'conv_mesma'
  // Fez o L: F$ 13 bi na mão e `valor` do gerador `alvo` (os estagiários) ao mesmo tempo
  | 'fez_o_l'
  // Mapa do rolê: lugares abertos (estado) e dono/pódio da semana (evento)
  | 'mapa_abriu' | 'mapa_dono' | 'mapa_podio'
  // camisetaria (evento): procura da coleção, nota 10 dos 4 influencers, coleção encalhada
  | 'tee_pct' | 'tee_quatro_dez' | 'tee_encalhe'
  | 'cup_nota' | 'cup_pt'
  // eras 1–5 (0074): eventos de era (evento) e "a era inteira" (estado)
  | 'evt_mae' | 'evt_shopee' | 'evt_call' | 'evt_tela' | 'evt_gols' | 'era_300' | 'era_melhorias'
  // dourados e Caixinha (0076), todas de evento (idle_ganhar com o contador de dourados_cont): maior Trend, Pix devolvidos,
  // derrotas e vitórias seguidas no Tigrinho, combos, cupons pegos, F$ de cashback; Insider na venda da Bolsa
  | 'trend_max' | 'pix_dev' | 'tigre_perdeu' | 'combos' | 'cupons' | 'cashback' | 'tigre_seq' | 'insider'
  // eras 6–7 (0078): Lixo espacial e Houston (de evento); o monolito, 1 de cada gerador da era 7 (de estado)
  | 'evt_lixo' | 'evt_houston' | 'monolito';

/** Conquista "ter 100" de cada gerador, na ordem dos geradores: [nome, frase]. Ids 1–30 e, do gerador 31 em diante, 140 + (g − 31) (idConquistaGerador em catalogo.ts). */
export const CONQUISTAS_GERADOR: readonly (readonly [string, string])[] = [
  ['Cem abas abertas', 'Cem abas, zero vagas aplicadas. Seu pai já desistiu de você em silêncio.'],
  ['Guru do LinkedIn', 'Escreveu "fui demitido e isso me ensinou" cem vezes. Ninguém te recontratou.'],
  ['PROCV emocional', 'Cruza dez mil linhas no Excel e não consegue cruzar a rua pra ir na terapia.'],
  ['Pirâmide familiar', 'Vendeu pra família toda. Agora o Natal é por videochamada e a tia não atende.'],
  ['CLT jamais', 'Cem clientes, zero férias, um burnout e nenhum INSS pra pagar o remédio.'],
  ['Live pra três pessoas', 'Cem horas ao vivo pra sua mãe, um bot e um cara que só pede pé.'],
  ['Estágio não remunerado em escala', 'Cem estagiários pagos em "experiência". A princesa Isabel ficaria decepcionada.'],
  ['Fábrica de chaveiro', 'Cem impressoras derretendo plástico. Seus pulmões vão entrar no grupo do processo.'],
  ['Rei do zap', 'Cem grupos de zap. Você é o motivo de inventarem o "silenciar por 1 ano".'],
  ['Chega em 40 dias', 'Revende lixo chinês com 400% de margem e chama de empreendedorismo. O Procon chama de outra coisa.'],
  ['Frota de food truck', 'Hambúrguer de F$ 49 com carne de origem desconhecida. A Vigilância Sanitária ainda não achou você.'],
  ['MercadoLíder Platinum', 'Cem lojas, mil reclamações, nenhum produto chegou inteiro.'],
  ['Cem episódios', 'Três homens sem terapia falando de investimento por cem episódios.'],
  ['Agência de influencer', 'Cem influencers vendendo chá emagrecedor pra menor de idade. Que orgulho.'],
  ['Tem um app pra isso', 'Cem apps pedindo sua localização, seus contatos e sua alma.'],
  ['Infoprodutor', 'Fica rico vendendo curso de como ficar rico pra gente que pegou empréstimo pra comprar.'],
  ['Agência das agências', 'Cem reels por semana. O cliente quebrou, mas o engajamento subiu 3%.'],
  ['Dono da Faria Lima', 'Colete, café de F$ 28 e dívida de F$ 28 milhões.'],
  ['Day trade em escala', 'Cem traders. Noventa e oito perderam a casa, dois vendem curso.'],
  ['Céu de anjos', 'Cem anjos investiram. O inferno foi a reunião de board.'],
  ['Nuvem própria', 'Cem servidores queimando um rio inteiro pra rodar um chatbot que mente.'],
  ['Série Z', 'Vinte e seis rodadas de investimento e o lucro ainda é um conceito.'],
  ['Inovação em escala industrial', 'Cem laboratórios de inovação e a maior ideia foi a cerveja na sexta.'],
  ['Não sobrou concorrente', 'Monopólio. Agora você pode piorar o produto e subir o preço.'],
  ['Viçador', 'O fígado pediu demissão e levou o rim junto.'],
  ['Olheiro', 'Cem times. Agora é tirar um moleque de 12 anos da família e vender pra Europa.'],
  ['Arquipélago', 'Cem ilhas particulares e ainda assim ninguém quer passar o fim de semana com você.'],
  ['Dono de Dubai', 'Mudou pra Dubai pra não pagar imposto. O Brasil agradece a sua ausência.'],
  ['A bolsa é sua', 'Cem IPOs. Os aposentados que compraram na alta mandam beijo.'],
  ['Frota interplanetária', 'Cem foguetes pra fugir do planeta que você ajudou a estragar.'],
  // geradores 31–42: ids 140–151 (os ids 31+ já eram das outras conquistas)
  ['Céu poluído', 'Cem satélites. Os astrônomos te odeiam.'],
  ['Turista de luxo', 'Cem voos de 11 minutos. Ninguém saiu direito da atmosfera.'],
  ['Cinco estrelas (de verdade)', 'Cem hotéis em órbita. O check-out é às 11 h, mas de qual fuso?'],
  ['Abra a porta, HAL', 'Cem HALs. Nenhum abre a porta.'],
  ['Catador de estrelas', 'Cem ferros-velhos. O lixo espacial agora tem dono.'],
  ['Missão cumprida, Harry', 'Cem equipes de perfuração. O asteroide nem viu.'],
  ['Abastece aí', 'Cem postos na Lua. O jipe agradece.'],
  ['Foi tudo gravado', 'Cem estúdios. Agora tem prova de que nada aconteceu.'],
  ['Queijo suíço espacial', 'Cem fazendas. A Lua está cada vez mais esburacada.'],
  ['Sou eu mesmo?', 'Cem minas, e cem de você trabalhando nelas.'],
  ['Lua no bolso', 'Cem raios encolhedores. A maré nunca mais foi a mesma.'],
  ['Do lado de lá', 'Cem bases no lado escuro, que de escuro não tem nada.'],
];

export type ConquistaTexto = {
  id: number; nome: string; frase: string; condicao: string; tipo: TipoConquista;
  alvo?: number; valor?: number; escondida?: boolean;
};

/** As outras conquistas: visíveis (31 a 72) e escondidas (101 em diante; só aparecem quando alguém do grupo
 *  consegue). Conquista nova = id novo e migração nova do catálogo; id nunca muda nem é reaproveitado (o banco guarda
 *  quem ganhou pelo id). */
export const CONQUISTAS: readonly ConquistaTexto[] = [
  { id: 31, tipo: 'taxa', valor: 1, nome: 'Primeiro real', frase: 'F$ 1 por segundo. A inflação comeu antes de você ver.', condicao: 'Produzir F$ 1 por segundo' },
  { id: 32, tipo: 'taxa', valor: 100, nome: 'Pix caindo', frase: 'F$ 100 por segundo e ainda some quando chega a conta do bar.', condicao: 'Produzir F$ 100 por segundo' },
  { id: 33, tipo: 'taxa', valor: 1e4, nome: 'O leão acordou', frase: 'A Receita sabe seu nome, seu CPF e onde você esconde o resto.', condicao: 'Produzir F$ 10 mil por segundo' },
  { id: 34, tipo: 'taxa', valor: 1e6, nome: 'Acumulou!', frase: 'Uma Mega da Virada por segundo e ainda assim ninguém te ama.', condicao: 'Produzir F$ 1 mi por segundo' },
  { id: 35, tipo: 'taxa', valor: 1e9, nome: 'Bilionário de LinkedIn', frase: 'Bilionário. Agora suas opiniões ruins têm alcance.', condicao: 'Produzir F$ 1 bi por segundo' },
  { id: 36, tipo: 'taxa', valor: 1e12, nome: 'Trilhão por segundo', frase: 'Maior que o PIB de vários países e menor que o seu vazio.', condicao: 'Produzir F$ 1 tri por segundo' },
  { id: 37, tipo: 'taxa', valor: 1e15, nome: 'Quatrilhão por segundo', frase: 'Nenhum número preenche o buraco que o seu pai deixou.', condicao: 'Produzir F$ 1 quatri por segundo' },
  { id: 38, tipo: 'taxa', valor: 1e18, nome: 'Casa da Moeda', frase: 'O dinheiro do mundo acabou. Parabéns, você é a crise.', condicao: 'Produzir F$ 1 quinti por segundo' },
  { id: 39, tipo: 'era', valor: 2, nome: 'Saiu da casa dos pais', frase: 'Agora mora na garagem. Dos pais. Com o carro do pai.', condicao: 'Chegar na era 2 (Garagem)' },
  { id: 40, tipo: 'era', valor: 3, nome: 'Tem até catraca', frase: 'Crachá, catraca e controle de ponto. Virou o chefe que você jurou que nunca seria.', condicao: 'Chegar na era 3 (Escritório)' },
  { id: 41, tipo: 'era', valor: 4, nome: 'Andar inteiro', frase: 'Um andar inteiro, mesa de pingue-pongue e uma salinha pra chorar.', condicao: 'Chegar na era 4 (Andar inteiro)' },
  { id: 42, tipo: 'era', valor: 5, nome: 'Sede própria', frase: 'Prédio com o seu nome e um funcionário morando nele porque não dá pra pagar aluguel com o salário.', condicao: 'Chegar na era 5 (Sede)' },
  { id: 43, tipo: 'gerador', alvo: 30, valor: 1, nome: 'Ao infinito e além', frase: 'Bilionário brincando de foguete enquanto o funcionário faz vaquinha pra cirurgia.', condicao: 'Ter 1 "Foguete pra Marte"' },
  { id: 44, tipo: 'melhorias', valor: 10, nome: 'Placa de vídeo nova', frase: 'Dez melhorias e o notebook ainda esquenta igual a sua relação com seus pais.', condicao: 'Comprar 10 melhorias' },
  { id: 45, tipo: 'melhorias', valor: 50, nome: 'Coach de produtividade', frase: 'Cinquenta melhorias e você ainda passou três horas no TikTok hoje.', condicao: 'Comprar 50 melhorias' },
  { id: 46, tipo: 'melhorias', valor: 150, nome: 'Tudo pela família', frase: 'Cento e cinquenta melhorias. Seu pai ainda prefere seu primo concursado.', condicao: 'Comprar 150 melhorias' },
  { id: 47, tipo: 'oportunidades', valor: 1, nome: 'Black Friday', frase: 'A primeira oportunidade. Pela metade do dobro, igual sua autoestima.', condicao: 'Pegar 1 oportunidade' },
  { id: 48, tipo: 'oportunidades', valor: 25, nome: 'Caça-promoção', frase: 'Vinte e cinco oportunidades e um cartão de crédito no rotativo a 400% ao ano.', condicao: 'Pegar 25 oportunidades' },
  { id: 49, tipo: 'oportunidades', valor: 100, nome: 'Oportunista', frase: 'Cem oportunidades. Sua ex tinha razão sobre você.', condicao: 'Pegar 100 oportunidades' },
  { id: 50, tipo: 'oportunidades', valor: 500, nome: 'Sniper', frase: 'Quinhentas oportunidades. Você não vê o sol desde o governo passado.', condicao: 'Pegar 500 oportunidades' },
  { id: 51, tipo: 'vendas', valor: 1, nome: 'Exit', frase: 'Vendeu a startup, demitiu o time por e-mail e postou "gratidão".', condicao: 'Vender a startup 1 vez' },
  { id: 52, tipo: 'vendas', valor: 5, nome: 'Empreendedor serial', frase: 'Abre, cresce, vende, demite, repete. Igual serial killer, só que legalizado.', condicao: 'Vender a startup 5 vezes' },
  { id: 53, tipo: 'vendas', valor: 10, nome: 'Unicórnio em série', frase: 'Dez exits. Nenhum produto funcionou, mas todo mundo saiu rico menos o cliente.', condicao: 'Vender a startup 10 vezes' },
  { id: 54, tipo: 'vendas', valor: 25, nome: 'Virou jurado do Shark Tank', frase: 'Vinte e cinco vendas. Agora humilha empreendedor pobre na televisão.', condicao: 'Vender a startup 25 vezes' },
  { id: 55, tipo: 'contratei', valor: 1, nome: 'Primeira contratação', frase: 'Agora você tem alguém pra culpar e pra demitir no Natal.', condicao: 'Contratar 1 vez' },
  { id: 56, tipo: 'contratei', valor: 10, nome: 'O RH sou eu', frase: 'Dez contratos, nenhum plano de saúde e um "somos uma família".', condicao: 'Contratar 10 vezes' },
  { id: 57, tipo: 'contratei', valor: 50, nome: 'Headhunter', frase: 'Cinquenta contratações, todas primos, todas incompetentes.', condicao: 'Contratar 50 vezes' },
  { id: 58, tipo: 'contratado', valor: 1, nome: 'Primeiro emprego', frase: 'Carteira assinada de mentira, assédio moral de verdade.', condicao: 'Ser contratado 1 vez' },
  { id: 59, tipo: 'contratado', valor: 10, nome: 'Passe valorizado', frase: 'Dez empresas te contrataram. Nenhuma quis ficar com você.', condicao: 'Ser contratado 10 vezes' },
  { id: 60, tipo: 'contratado', valor: 50, nome: 'Funcionário do mês, todo mês', frase: 'Cinquenta contratos. Sua família te vê menos que o RH.', condicao: 'Ser contratado 50 vezes' },
  { id: 61, tipo: 'estrategia_era', nome: 'Indeciso profissional', frase: 'Testou todas as estratégias porque não sabe o que quer. Nem da vida.', condicao: 'Usar as 3 estratégias de uma era (uma em cada empresa)' },
  { id: 62, tipo: 'estrategia_todas', nome: 'Kwisatz Haderach', frase: 'Viu todos os futuros possíveis. Em nenhum deles você dá certo.', condicao: 'Usar todas as estratégias liberadas' },
  // horta do Food truck (0048)
  { id: 63, tipo: 'horta_pix', nome: 'Dinheiro dá em árvore sim', frase: 'Seu pai mentiu pra você. Não foi a primeira nem vai ser a última.', condicao: 'Plantar o primeiro Pé de Pix' },
  { id: 64, tipo: 'horta_plantou', valor: 100, nome: 'Agro é pop', frase: 'Agro é tech, agro é pop, agro é isenção fiscal e agrotóxico proibido na Europa.', condicao: 'Plantar 100 plantas' },
  { id: 65, tipo: 'horta_colheu', valor: 50, nome: 'Colheita Feliz', frase: 'Cinquenta colheitas. Ninguém rouba seu ovo porque ninguém mais lembra que você existe.', condicao: 'Colher 50 plantas' },
  { id: 66, tipo: 'horta_mandioca', nome: 'Saudando a mandioca', frase: 'A maior conquista do Brasil. O resto do país ainda está esperando a dele.', condicao: 'Descobrir a Mandioca Turbo' },
  { id: 67, tipo: 'horta_coentro', nome: 'Coentro é bom sim', frase: 'Metade do grupo te bloqueou. A outra metade nunca gostou de você mesmo.', condicao: 'Colher um Coentro' },
  { id: 68, tipo: 'horta_inhame', nome: 'Pai rico, pai pobre', frase: 'Leu a capa do livro e já acha que entende de juros compostos.', condicao: 'Descobrir o Inhame do Primo Rico' },
  { id: 69, tipo: 'horta_abacate', nome: 'Shape inexplicável', frase: 'Diz que é só abacate. O fígado diz outra coisa.', condicao: 'Colher um Abacate Proteico' },
  { id: 70, tipo: 'horta_morreu', valor: 10, nome: 'Planta de plástico era melhor', frase: 'Matou dez plantas. Ainda bem que você não teve filho.', condicao: 'Deixar 10 plantas morrerem de velhas' },
  { id: 71, tipo: 'horta_colecao', valor: 8, nome: 'Temos que plantar', frase: 'Pegou todas. Igual Pokémon, só que ninguém do grupo achou legal.', condicao: 'Descobrir as 8 plantas da horta' },
  { id: 72, tipo: 'gerador', alvo: 11, valor: 200, nome: 'Fazendinha do Facebook', frase: 'Duzentos food trucks, horta 6 × 6 e nenhum amigo pra regar.', condicao: 'Ter 200 "Food truck" (horta 6 × 6)' },
  // convidados do PPP Podcast (0051)
  { id: 73, tipo: 'conv_sentou', nome: 'Tá gravando?', frase: 'Episódio 1: 40 minutos arrumando o microfone.', condicao: 'Sentar o primeiro convidado' },
  { id: 74, tipo: 'conv_mesa', nome: 'Mesacast', frase: 'Três convidados, um microfone funcionando e zero pauta.', condicao: 'Ter as 3 cadeiras ocupadas' },
  { id: 75, tipo: 'conv_vistos', valor: 11, nome: 'Todo mundo já sentou aqui', frase: 'Até o Kojima chegou no horário.', condicao: 'Sentar os 11 convidados ao menos uma vez' },
  { id: 76, tipo: 'conv_cr', nome: 'Água!', frase: 'Afastou duas Coca-Colas e a marca perdeu 4 bilhões. Respeita.', condicao: 'Sentar o Cristiano Ronaldo na cadeira da frente' },
  { id: 77, tipo: 'conv_fgc', nome: 'O FGC não cobre', frase: 'Rendia 140% do CDI. Rendia.', condicao: 'Ter uma ação do Vorcaro virando pó' },
  { id: 78, tipo: 'conv_kojima', nome: 'Que geometria', frase: 'Ficou 24 h no estúdio e entregou uma encomenda.', condicao: 'Deixar o Kojima 24 h sentado' },
  { id: 79, tipo: 'conv_hl3', nome: 'Half-Life 3 confirmado', frase: 'Ele finalmente contou até 3.', condicao: 'Sentar o Gabe Newell na 3ª cadeira' },
  { id: 80, tipo: 'conv_derrubada', valor: 1, nome: 'Sample não liberado', frase: 'Lost media brasileira.', condicao: 'Ter uma faixa do MC V.V derrubada por copyright' },
  { id: 81, tipo: 'conv_toby', nome: 'Já já sai o Chapter 6', frase: 'Ficou 20 horas esperando. O Toby também.', condicao: 'Deixar o Toby Fox 20 h sentado sem trocar' },
  { id: 82, tipo: 'opp_dia', valor: 15, nome: 'Receba!', frase: 'Obrigado meu Deus, obrigado meu pai.', condicao: 'Pegar 15 oportunidades num dia' },
  { id: 83, tipo: 'mapa_abriu', valor: 1, nome: 'Rolê marcado', frase: 'Saiu de casa. Pelo jogo, mas saiu.', condicao: 'Abrir o primeiro lugar do Mapa do rolê' },
  { id: 84, tipo: 'mapa_abriu', valor: 3, nome: 'Conhece a cidade', frase: 'Três lugares e nenhum convite pro aniversário.', condicao: 'Abrir 3 lugares do Mapa do rolê' },
  { id: 85, tipo: 'mapa_dono', nome: 'Dono do pedaço', frase: 'Uma semana mandando no pedaço. Ninguém respeitou.', condicao: 'Ser o 1º da semana em algum lugar' },
  { id: 86, tipo: 'mapa_podio', nome: 'Tá no pódio', frase: 'Foto na parede. Ninguém olha, mas tá lá.', condicao: 'Entrar no pódio de algum lugar' },
  { id: 87, tipo: 'tee_pct', valor: 200, nome: 'Esgotou', frase: 'Esgotou. O fornecedor já subiu o preço.', condicao: 'Coleção com 200% de procura' },
  { id: 88, tipo: 'tee_quatro_dez', nome: 'Quatro dez', frase: 'Até o @luisviton deu dez. Print e emoldura.', condicao: 'Coleção com nota 10 dos 4 influencers' },
  { id: 89, tipo: 'cup_nota', valor: 900, nome: 'Nota mil (quase)', frase: 'Faltou 99 pra perfeição. Faltou a dignidade também.', condicao: 'Copão com nota 900 ou mais' },
  // eras 1–5 (0073): eventos de era, 300 de cada gerador da era, todas as melhorias da era
  { id: 116, tipo: 'evt_mae', valor: 10, nome: 'Já vou, mãe!', frase: 'Disse "já vou" dez vezes. Ela sabe que é mentira.', condicao: 'Atender a mãe 10 vezes' },
  { id: 117, tipo: 'evt_shopee', valor: 10, nome: 'Taxa das blusinhas', frase: 'Pagou imposto em dez pacotes de coisa que você nem lembra que comprou.', condicao: 'Abrir 10 pacotes da Shopee' },
  { id: 118, tipo: 'evt_call', valor: 25, nome: 'Podia ser um e-mail', frase: 'Fugiu de vinte e cinco reuniões. Ninguém percebeu, nem quando você estava nelas.', condicao: 'Sair de 25 reuniões' },
  { id: 119, tipo: 'evt_tela', valor: 10, nome: 'Já tentou desligar e ligar?', frase: 'Dez telas azuis. O TI mandou abrir chamado.', condicao: 'Reiniciar 10 telas azuis' },
  { id: 120, tipo: 'evt_gols', valor: 7, nome: '7 a 1 (pra nós)', frase: 'Agora sim. Ninguém do grupo lembra de 2014.', condicao: 'Fazer os 7 gols num Jogo do Brasil' },
  { id: 121, tipo: 'era_300', alvo: 1, nome: 'Quarto lotado', frase: 'Trezentos de cada coisa e a cama ainda é um colchão no chão.', condicao: 'Ter 300 de cada gerador da era 1' },
  { id: 122, tipo: 'era_300', alvo: 2, nome: 'A garagem não fecha mais', frase: 'O carro do seu pai dorme na rua há dois anos.', condicao: 'Ter 300 de cada gerador da era 2' },
  { id: 123, tipo: 'era_300', alvo: 3, nome: 'Open space', frase: 'Sem parede, sem privacidade, sem saída.', condicao: 'Ter 300 de cada gerador da era 3' },
  { id: 124, tipo: 'era_300', alvo: 4, nome: 'A Faria Lima é minha', frase: 'Cada colete da avenida tem o seu logo.', condicao: 'Ter 300 de cada gerador da era 4' },
  { id: 125, tipo: 'era_300', alvo: 5, nome: 'Holding das holdings', frase: 'Uma empresa dona da outra, e nenhuma paga imposto.', condicao: 'Ter 300 de cada gerador da era 5' },
  { id: 126, tipo: 'era_melhorias', alvo: 1, nome: 'Setup completo', frase: 'Tudo comprado. Agora só falta sair do quarto.', condicao: 'Comprar todas as melhorias da era 1' },
  { id: 127, tipo: 'era_melhorias', alvo: 2, nome: 'Garagem tunada', frase: 'Melhoria de sobra e o portão ainda é manual.', condicao: 'Comprar todas as melhorias da era 2' },
  { id: 128, tipo: 'era_melhorias', alvo: 3, nome: 'Escritório premium', frase: 'Até a cadeira da reunião faz massagem. A reunião continua inútil.', condicao: 'Comprar todas as melhorias da era 3' },
  { id: 129, tipo: 'era_melhorias', alvo: 4, nome: 'Andar de luxo', frase: 'Banheiro novo pra estagiário chorar com conforto.', condicao: 'Comprar todas as melhorias da era 4' },
  { id: 130, tipo: 'era_melhorias', alvo: 5, nome: 'Sede cinco estrelas', frase: 'Heliponto, academia e um RH que não responde.', condicao: 'Comprar todas as melhorias da era 5' },
  // dourados e Caixinha (0075): as de evento saem de idle_ganhar com o contador (0076)
  { id: 132, tipo: 'trend_max', valor: 20, nome: 'Dancinha do TikTok', frase: 'Vinte moedas em oito segundos. Seu polegar tem mais seguidor que você.', condicao: 'Pegar as 20 moedinhas de um Trend' },
  { id: 133, tipo: 'pix_dev', valor: 10, nome: 'Cidadão de bem', frase: 'Devolveu dez Pix. O banco nunca te devolveu nada.', condicao: 'Devolver 10 Pix errados' },
  { id: 134, tipo: 'tigre_perdeu', valor: 10, nome: 'Só mais uma', frase: 'Dez derrotas. Amanhã você recupera, com certeza.', condicao: 'Perder 10 vezes no Tigrinho' },
  { id: 135, tipo: 'combos', valor: 10, nome: 'C-C-C-Combo!', frase: 'Dez combos seguidos. O narrador ficou rouco.', condicao: 'Fazer 10 Combos' },
  { id: 136, tipo: 'cupons', valor: 25, nome: 'Primeira compra (de novo)', frase: 'Vinte e cinco primeiras compras, todas no mesmo CPF.', condicao: 'Pegar 25 Cupons de primeira compra' },
  { id: 137, tipo: 'cashback', valor: 1e12, nome: 'Volta pra conta', frase: 'Um trilhão de volta. O que você gastou pra isso, melhor nem somar.', condicao: 'Receber F$ 1 tri de cashback' },
  // eras 6–7 (0077/0078); as "ter 100" dos geradores 31–42 (140–151) estão em CONQUISTAS_GERADOR
  { id: 152, tipo: 'era_300', alvo: 6, nome: 'Órbita lotada', frase: 'Trezentos de cada. O céu virou estacionamento.', condicao: 'Ter 300 de cada gerador da era 6' },
  { id: 153, tipo: 'era_300', alvo: 7, nome: 'Condomínio lunar', frase: 'A Lua tem síndico agora. É você.', condicao: 'Ter 300 de cada gerador da era 7' },
  { id: 154, tipo: 'era_melhorias', alvo: 6, nome: 'Estação completa', frase: 'Tudo comprado. Até o banheiro funciona sem gravidade.', condicao: 'Comprar todas as melhorias da era 6' },
  { id: 155, tipo: 'era_melhorias', alvo: 7, nome: 'Lua de luxo', frase: 'Cada cratera com hidromassagem.', condicao: 'Comprar todas as melhorias da era 7' },
  { id: 156, tipo: 'evt_lixo', valor: 3, nome: 'Desviou de tudo', frase: 'Nenhum arranhão. Nem no satélite do vizinho.', condicao: 'Desviar os 3 destroços de um Lixo espacial' },
  { id: 157, tipo: 'evt_houston', valor: 10, nome: 'Silver tape resolve', frase: 'Dez problemas, um rolo de fita.', condicao: 'Consertar 10 "Houston, temos um problema"' },
  { id: 101, escondida: true, tipo: 'gerador_exato', valor: 67, nome: '6-7', frase: 'Seis sete. Ninguém sabe por quê.', condicao: 'Ter exatamente 67 de algum gerador' },
  { id: 102, escondida: true, tipo: 'aura', nome: 'Farmou aura', frase: '+1000 de aura.', condicao: 'Ficar em 1º no placar' },
  { id: 103, escondida: true, tipo: 'aura_negativa', nome: 'Aura negativa', frase: 'Vendeu por um real e um abraço.', condicao: 'Vender a startup e ganhar só 1 ponto' },
  { id: 105, escondida: true, tipo: 'jaula', valor: 100, nome: 'Tá saindo da jaula', frase: 'Birl! O monstro tá saindo da jaula.', condicao: 'Levar 100 ou mais de uma vez no Máx' },
  { id: 106, escondida: true, tipo: 'melhoria', alvo: 283, nome: 'Guiana Brasileira', frase: 'Fala galera! A Guiana Brasileira agora tem sede.', condicao: 'Comprar "Filial em Portugal"' },
  { id: 107, escondida: true, tipo: 'fez_o_l', alvo: 7, valor: 130, nome: 'Fez o L', frase: 'L de Luis, que fique claro.', condicao: 'Ter F$ 13 bi e 130 "Estagiário" ao mesmo tempo' },
  { id: 108, escondida: true, tipo: 'madrugada', nome: '3h06', frase: 'Bora fundar uma empresa?', condicao: 'Abrir a Fellas Inc. entre 3h e 4h da manhã' },
  { id: 109, escondida: true, tipo: 'sigma', nome: 'Modo sigma', frase: 'Lobo solitário do empreendedorismo.', condicao: 'Vender a startup sem nunca ter contratado ninguém' },
  { id: 110, escondida: true, tipo: 'unicornio', nome: 'Pai tá on', frase: 'O pai tá on.', condicao: 'Ser o unicórnio da semana' },
  { id: 111, escondida: true, tipo: 'brainrot', valor: 60, nome: 'Brainrot', frase: 'Tung tung tung empreendedor.', condicao: 'Pegar 3 oportunidades em menos de 1 minuto' },
  { id: 112, escondida: true, tipo: 'horta_morango', nome: 'Ele tem pescoço sim', frase: 'Você viu com seus próprios olhos.', condicao: 'Ver um Morango com Pescoço brotar' },
  { id: 113, escondida: true, tipo: 'conv_mesma', nome: 'São a mesma pessoa?', frase: 'Nunca foram vistos juntos.', condicao: 'Tentar sentar o Gemaplys e o MC V.V juntos' },
  { id: 114, escondida: true, tipo: 'tee_encalhe', nome: 'Coleção encalhada', frase: 'Vai virar pano de chão de luxo.', condicao: 'Coleção com menos de 20% de procura' },
  { id: 115, escondida: true, tipo: 'cup_pt', nome: 'Deu PT', frase: 'A galera foi embora carregada. Literalmente.', condicao: 'Ter PT numa noite' },
  { id: 131, escondida: true, tipo: 'melhoria', alvo: 138, nome: 'Embaixo do lago prateado', frase: 'Toda música tem uma mensagem escondida. Essa também.', condicao: 'Comprar "Mensagem subliminar no episódio"' },
  { id: 138, escondida: true, tipo: 'tigre_seq', valor: 3, nome: 'O tigre tá pagando', frase: 'Ele deixou você ganhar. É assim que começa.', condicao: 'Ganhar 3 seguidas no Tigrinho depois das 3 grátis' },
  { id: 139, escondida: true, tipo: 'insider', valor: 1, nome: 'Insider (shh)', frase: 'A CVM quer saber a sua localização.', condicao: 'Vender com 100% de lucro uma ação de empresa espiada nas últimas 2 h' },
  { id: 158, escondida: true, tipo: 'monolito', nome: 'Meu Deus, está cheio de estrelas', frase: 'Alguém deixou isso aqui há 4 milhões de anos.', condicao: 'Ter pelo menos 1 de cada gerador da era 7' },
  { id: 159, escondida: true, tipo: 'melhoria', alvo: 348, nome: 'Daisy, Daisy', frase: 'Ele cantou até a voz acabar.', condicao: 'Comprar "Daisy, Daisy"' },
];

/** Ramos da árvore de habilidades: 0 é a raiz; 1 a 6 são os ramos (o Tempo virou Dourados e a Horta entrou em 13/10). */
export const RAMOS: readonly string[] = ['Raiz', 'Produção', 'Recomeço', 'Oportunidades', 'Dourados', 'Gente', 'Horta'];

/** O que cada nó faz. Valor: multiplicador (producao, opp_bonus, contrato_preco, emprego_mult, dourado_freq,
 *  dourado_investidor, dourado_duracao, horta_amadurece, horta_vida, horta_cruza, horta_mult, morango_chance),
 *  segundos (segundos: quanto a oportunidade fica na cena; dourado_tela: quanto o evento fica na tela), quantidade
 *  (caixinha, opp_extra, inicio_notebooks, contrato_dias), reais (inicio_valuation), fração (por_contratado) ou 1
 *  (inicio_era1, manter_gerais: só ter o nó). */
export type TipoNo =
  | 'producao' | 'inicio_valuation' | 'inicio_notebooks' | 'manter_gerais' | 'inicio_era1'
  | 'caixinha' | 'segundos' | 'opp_extra' | 'opp_bonus'
  | 'contrato_preco' | 'por_contratado' | 'contrato_dias' | 'emprego_mult'
  | 'dourado_freq' | 'dourado_tela' | 'dourado_investidor' | 'dourado_duracao'
  | 'horta_amadurece' | 'horta_vida' | 'horta_cruza' | 'horta_mult' | 'morango_chance';

export type NoTexto = { ramo: number; posicao: number; nome: string; efeito: string; tipo: TipoNo; valor: number };

/** A árvore de habilidades, na ordem: a raiz e os 6 ramos de 5 nós. id = ramo·10 + posição (a raiz é 1). Nó novo ou
 *  efeito mudado = migração nova do catálogo; id nunca muda (o banco guarda quem comprou pelo id). */
export const ARVORE: readonly NoTexto[] = [
  { ramo: 0, posicao: 1, tipo: 'producao', valor: 1.05, nome: 'Virou MEI', efeito: 'Abre a árvore. Produção +5%.' },
  { ramo: 1, posicao: 1, tipo: 'producao', valor: 1.1, nome: 'Cafezinho de garrafa térmica', efeito: 'Produção +10%.' },
  { ramo: 1, posicao: 2, tipo: 'producao', valor: 1.25, nome: 'Ô loco, bicho!', efeito: 'Produção +25%.' },
  { ramo: 1, posicao: 3, tipo: 'producao', valor: 1.5, nome: 'Turno dobrado', efeito: 'Produção +50%.' },
  { ramo: 1, posicao: 4, tipo: 'producao', valor: 2, nome: 'Tema da Vitória', efeito: 'Produção +100%.' },
  { ramo: 1, posicao: 5, tipo: 'producao', valor: 2, nome: 'O hexa vem', efeito: 'Produção ×2 em tudo.' },
  { ramo: 2, posicao: 1, tipo: 'inicio_valuation', valor: 1000, nome: 'Porquinho quebrado', efeito: 'O Abrir CNPJ começa com F$ 1 mil.' },
  { ramo: 2, posicao: 2, tipo: 'inicio_notebooks', valor: 10, nome: 'Notebook da Positivo', efeito: 'O Abrir CNPJ começa com 10 notebooks.' },
  { ramo: 2, posicao: 3, tipo: 'manter_gerais', valor: 1, nome: 'Leva o crachá', efeito: 'Vender a startup mantém as melhorias gerais.' },
  { ramo: 2, posicao: 4, tipo: 'inicio_valuation', valor: 1e6, nome: 'Herança da tia rica', efeito: 'O Abrir CNPJ começa com F$ 1 mi.' },
  { ramo: 2, posicao: 5, tipo: 'inicio_era1', valor: 1, nome: 'Material escolar completo', efeito: 'O Abrir CNPJ começa com 1 de cada gerador da era 1.' },
  { ramo: 3, posicao: 1, tipo: 'caixinha', valor: 4, nome: 'Grupo de promoção no zap', efeito: 'A caixinha guarda 4 oportunidades.' },
  { ramo: 3, posicao: 2, tipo: 'segundos', valor: 30, nome: 'Print de tudo', efeito: 'Oportunidades passam 30 s na cena.' },
  { ramo: 3, posicao: 3, tipo: 'opp_extra', valor: 3, nome: 'Relâmpago da Shopee', efeito: '+3 oportunidades por dia.' },
  { ramo: 3, posicao: 4, tipo: 'opp_bonus', valor: 2, nome: 'Xepa da feira', efeito: 'Oportunidades rendem o dobro.' },
  { ramo: 3, posicao: 5, tipo: 'caixinha', valor: 5, nome: 'Gaveta de tranqueira', efeito: 'A caixinha guarda 5 oportunidades.' },
  { ramo: 4, posicao: 1, tipo: 'dourado_freq', valor: 1.5, nome: 'Pé de coelho', efeito: 'Eventos aparecem 50% mais vezes.' },
  { ramo: 4, posicao: 2, tipo: 'dourado_tela', valor: 24, nome: 'Olho de lince', efeito: 'Eventos ficam 24 s na tela (no lugar de 12).' },
  { ramo: 4, posicao: 3, tipo: 'dourado_investidor', valor: 2, nome: 'Investidor anjo', efeito: 'Investidor apressado rende 40 min de produção (no lugar de 20).' },
  { ramo: 4, posicao: 4, tipo: 'dourado_duracao', valor: 2, nome: 'Hype de lançamento', efeito: 'Viralizou e Promoção duram o dobro.' },
  { ramo: 4, posicao: 5, tipo: 'dourado_freq', valor: 2, nome: 'Dia de sorte', efeito: 'Eventos aparecem 2× mais vezes.' },
  { ramo: 5, posicao: 1, tipo: 'contrato_preco', valor: 0.75, nome: 'Placa de "Precisa-se"', efeito: 'Contratar custa 25% menos.' },
  { ramo: 5, posicao: 2, tipo: 'por_contratado', valor: 0.15, nome: 'Aniversariante do mês', efeito: 'Seus contratados rendem 15% (no lugar de 10%).' },
  { ramo: 5, posicao: 3, tipo: 'contrato_dias', valor: 10, nome: 'Carteira assinada', efeito: 'Os contratos que você faz duram 10 dias.' },
  { ramo: 5, posicao: 4, tipo: 'emprego_mult', valor: 2, nome: 'Passe de craque', efeito: 'Quem te contrata rende o dobro pra você.' },
  { ramo: 5, posicao: 5, tipo: 'contrato_preco', valor: 0.5, nome: 'Jovem Aprendiz', efeito: 'Contratar custa 50% menos.' },
  { ramo: 6, posicao: 1, tipo: 'horta_amadurece', valor: 0.75, nome: 'Borra de café no adubo', efeito: 'Plantas novas amadurecem 25% mais rápido.' },
  { ramo: 6, posicao: 2, tipo: 'horta_vida', valor: 1.5, nome: 'Regador automático', efeito: 'Plantas novas vivem 50% a mais depois de maduras.' },
  { ramo: 6, posicao: 3, tipo: 'horta_cruza', valor: 2, nome: 'Abelha influencer', efeito: 'Cruzamento da Horta 2× mais fácil.' },
  { ramo: 6, posicao: 4, tipo: 'horta_mult', valor: 1.5, nome: 'Agrotóxico liberado', efeito: 'Bônus das plantas ×1,5 (descontos seguem até 50%).' },
  { ramo: 6, posicao: 5, tipo: 'morango_chance', valor: 5, nome: 'Morango do amor', efeito: 'Morango com Pescoço brota 5× mais.' },
];
