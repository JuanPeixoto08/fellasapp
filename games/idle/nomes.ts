// Textos da Fellas Inc.: dá pra trocar nomes e frases à vontade (a lógica usa só os ids e os números).
// Depois de mudar, crie uma migração nova do catálogo (ver o cabeçalho gerado em catalogo.ts).

/** Os 30 geradores, na ordem. A cada 6 começa uma era (e uma cena). */
export const GERADORES: readonly string[] = [
  'Você, no notebook da faculdade', 'Post motivacional no LinkedIn', 'Planilha no Excel',
  'Vendendo pra tia no grupo da família', 'Freela no Fiverr', 'Live na Twitch',
  'Estagiário', 'Impressora 3D', 'Grupo de vendas no zap', 'Dropshipping', 'Food truck', 'Loja no Mercado Livre',
  'PPP Podcast', 'Influencer parceiro', 'App na App Store', 'Curso online', 'Agência de marketing', 'Coworking próprio',
  'Grupo de trader', 'Investidor anjo', 'Fazenda de servidores', 'Rodada série A', 'Laboratório de inovação',
  'Fusão com a concorrência',
  'Rolê patrocinado', 'Comprar um time do Brasileirão', 'Ilha particular', 'Filial em Dubai', 'IPO na bolsa',
  'Foguete pra Marte',
];

/** As 5 melhorias de cada gerador (níveis 1, 10, 25, 50 e 100 unidades); cada uma dobra o gerador. */
export const MELHORIAS_GERADOR: readonly (readonly [string, string, string, string, string])[] = [
  ['Carregador original', 'Wi-Fi da biblioteca', 'Segundo monitor', 'Café de máquina', 'Noite virada'],
  ['Foto de terno', 'Textão com emoji', 'Selo de "open to work"', 'Post às 7h da manhã', 'Viralizou no feed'],
  ['PROCV', 'Tabela dinâmica', 'Macro que ninguém entende', 'Gráfico colorido', 'Planilha que ninguém mexe'],
  ['Áudio de 3 minutos', 'Figurinha de bom dia', 'Desconto de família', 'Fiado da tia', 'Tia influencer'],
  ['Cinco estrelas', 'Entrega no mesmo dia', 'Cliente gringo', 'Pacote premium', 'Top Rated'],
  ['Microfone bom', 'Overlay animado', 'Raid surpresa', 'Sub de 1 real', 'Live de 12 horas'],
  ['Crachá com foto', 'Vale-transporte', 'Cafeteira só dele', 'Hora extra (não paga)', 'Efetivação (talvez)'],
  ['Filamento roxo', 'Bico novo', 'Imprimindo a noite toda', 'Segunda impressora', 'Fazenda de impressoras'],
  ['Lista de transmissão', 'Mensagem fixada', 'Status com preço', 'Grupo 2 (lotado)', 'Grupo 3 (VIP)'],
  ['Fornecedor que responde', 'Frete em 40 dias', 'Anúncio no story', 'Loja com domínio próprio', 'Fornecedor nacional'],
  ['Molho da casa', 'Ponto na orla', 'Cardápio no QR', 'Segundo truck', 'Fila dobrando a esquina'],
  ['Frete grátis', 'Medalha amarela', 'Medalha verde', 'MercadoLíder', 'Full'],
  ['Microfone condensador', 'Corte pro TikTok', 'Convidado famoso', 'Episódio de 4 horas', 'Patrocínio de energético'],
  ['Publi com cupom', 'Arroba marcado', 'Recebidos', 'Stories de 15 em 15', 'Collab'],
  ['Ícone bonito', 'Modo escuro', 'Avaliação 4,9', 'Notificação na hora certa', 'App do Ano'],
  ['Aula bônus', 'Certificado com selo', 'Comunidade no Discord', 'Mentoria em grupo', 'Turma esgotada'],
  ['Mídia kit', 'Cliente fixo', 'Reels toda semana', 'Prêmio de agência', 'Conta grande'],
  ['Café liberado', 'Sala de reunião de vidro', 'Pufe colorido', 'Lista de espera', 'Segunda unidade'],
  ['Gráfico de velas', 'Alerta no celular', 'Stop no lugar certo', 'Bot de sinais', 'Mesa proprietária'],
  ['Pitch de 3 minutos', 'Café com investidor', 'Cheque assinado', 'Investidor que indica outro', 'Conselho consultivo'],
  ['Ar-condicionado', 'Nobreak', 'Rack novo', 'Refrigeração líquida', 'Data center próprio'],
  ['Deck bonito', 'Valuation pré-money', 'Lead investor', 'Rodada estendida', 'Série B à vista'],
  ['Post-its na parede', 'Design thinking', 'Hackathon', 'Patente registrada', 'Protótipo que funciona'],
  ['Due diligence', 'Aperto de mão', 'Sinergias (de verdade)', 'Logo novo', 'Monopólio (quase)'],
  ['Pulseira VIP', 'Open bar', 'DJ famoso', 'Camarote', 'Line-up internacional'],
  ['Virar SAF', 'Contratar técnico português', 'Patrocínio master', 'Estádio reformado', 'Título do Brasileirão'],
  ['Píer', 'Heliponto', 'Resort', 'Festa na ilha', 'Ilha vizinha'],
  ['Escritório no arranha-céu', 'Carro de luxo da firma', 'Filial em Portugal', 'Parceiro xeique', 'Torre própria'],
  ['Tocar o sino', 'Ação em alta', 'Dividendos', 'Índice da bolsa', 'Bilionário na capa'],
  ['Motor reutilizável', 'Lançamento sem explodir', 'Estação em órbita', 'Base na Lua', 'Colônia em Marte'],
];

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
  ativa?: boolean; requer?: 'contratos' | 'propriedades';
  genDe?: number; genAte?: number; genMult?: number; prodMult?: number; custoMult?: number;
  oppBonusMult?: number; oppExtra?: number; oppSegundos?: number; porGeradorDistinto?: number;
  sociais?: Record<string, number>;
};

/** Estratégias: 3 por era (2 a 5). `ativa: false` = depende de algo que ainda não chegou. */
export const ESTRATEGIAS: readonly EstrategiaTexto[] = [
  { era: 2, opcao: 0, nome: 'Bootstrapping', frase: 'Cresce com o que tem: os geradores do 1 ao 12 rendem 50% a mais.', genDe: 1, genAte: 12, genMult: 1.5 },
  { era: 2, opcao: 1, nome: 'Queimar caixa', frase: 'Tudo custa 25% a mais, mas a produção sobe 60%.', custoMult: 1.25, prodMult: 1.6 },
  { era: 2, opcao: 2, nome: 'Networking', frase: 'Contratos e propriedades valem o dobro.', requer: 'contratos', sociais: { contratoEfeitoMult: 2, propriedadeEfeitoMult: 2 } },
  { era: 3, opcao: 0, nome: 'Viralizar', frase: 'Oportunidades rendem o dobro e o limite do dia sobe 3.', oppBonusMult: 2, oppExtra: 3 },
  { era: 3, opcao: 1, nome: 'Foco no produto', frase: 'Os geradores do 13 ao 18 rendem o dobro.', genDe: 13, genAte: 18, genMult: 2 },
  { era: 3, opcao: 2, nome: 'Marca forte', frase: '+5% de produção por propriedade sua.', ativa: false, requer: 'propriedades', sociais: { porPropriedade: 0.05 } },
  { era: 4, opcao: 0, nome: 'Abrir capital', frase: 'Produção +30%, mas contratar custa o dobro.', prodMult: 1.3, sociais: { contratoCustoMult: 2 } },
  { era: 4, opcao: 1, nome: 'Monopólio', frase: 'Suas propriedades rendem o dobro; tomar custa 50% a mais pra você.', ativa: false, requer: 'propriedades', sociais: { propriedadeBeneficioMult: 2, tomarCustoMult: 1.5 } },
  { era: 4, opcao: 2, nome: 'Cultura de startup', frase: '+15% por contratado, e seus contratados ganham o triplo.', requer: 'contratos', sociais: { porContratado: 0.15, empregadoMult: 3 } },
  { era: 5, opcao: 0, nome: 'Expansão global', frase: 'Os geradores do 25 ao 30 rendem o dobro.', genDe: 25, genAte: 30, genMult: 2 },
  { era: 5, opcao: 1, nome: 'Holding', frase: '+3% de produção por gerador diferente que você tem.', porGeradorDistinto: 0.03 },
  { era: 5, opcao: 2, nome: 'Rolê eterno', frase: 'Oportunidades ficam 30 segundos na tela e o limite do dia sobe 5.', oppSegundos: 30, oppExtra: 5 },
];

/** Nome de cada era (é a cena). */
export const ERAS: readonly string[] = ['Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede'];

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
  | 'conv_toby' | 'opp_dia' | 'conv_mesma';

/** Conquista "ter 100" de cada gerador (ids 1 a 30, na ordem dos geradores): [nome, frase]. */
export const CONQUISTAS_GERADOR: readonly (readonly [string, string])[] = [
  ['Cem abas abertas', 'O notebook pede arrego.'],
  ['Guru do LinkedIn', 'Concorda? Comenta "sim".'],
  ['Excel avançado (de verdade)', 'PROCV até no sonho.'],
  ['A família toda comprou', 'Até o tio do pavê.'],
  ['Freela vira firma', 'Cem clientes e nenhum contrato.'],
  ['Streamer em tempo integral', 'Live de 100 horas, quem nunca.'],
  ['Estágio não remunerado em escala', 'Cem estagiários, uma cafeteira.'],
  ['Fábrica de chaveiro', 'O cheiro de plástico é o do sucesso.'],
  ['Rei do zap', 'Cem grupos e nenhum silenciado.'],
  ['Chega em 40 dias', 'O cliente ainda tá esperando.'],
  ['Frota de food truck', 'Engarrafamento de molho da casa.'],
  ['MercadoLíder Platinum', 'Frete grátis acima de tudo.'],
  ['Cem episódios', 'Ninguém lembra o que falou no 37.'],
  ['Agência de influencer', 'Todo mundo com o seu cupom.'],
  ['Tem um app pra isso', 'E todos pedem cinco estrelas.'],
  ['Infoprodutor', 'Curso de como vender curso.'],
  ['Agência das agências', 'Cem reels por semana.'],
  ['Dono da Faria Lima', 'Café liberado em cem andares.'],
  ['Day trade em escala', 'Stop é pra quem tem medo.'],
  ['Céu de anjos', 'Cem cheques e nenhum conselho útil.'],
  ['Nuvem própria', 'A conta de luz tem mais dígitos que o valuation.'],
  ['Série Z', 'Acabou o alfabeto e ainda tem rodada.'],
  ['Inovação em escala industrial', 'Cem post-its por metro quadrado.'],
  ['Não sobrou concorrente', 'O CADE quer conversar.'],
  ['Rolê todo dia', 'O fígado pediu férias.'],
  ['Liga própria', 'Cem times e ninguém cai.'],
  ['Arquipélago', 'Já dá pra fundar um país.'],
  ['Dono de Dubai', 'O xeique pede conselho pra você.'],
  ['A bolsa é sua', 'Quem toca o sino é você.'],
  ['Frota interplanetária', 'Marte já tem fila de embarque.'],
];

export type ConquistaTexto = {
  id: number; nome: string; frase: string; condicao: string; tipo: TipoConquista;
  alvo?: number; valor?: number; escondida?: boolean;
};

/** As outras conquistas: visíveis (31 a 72) e escondidas (101 em diante; só aparecem quando alguém do grupo
 *  consegue). Conquista nova = id novo e migração nova do catálogo; id nunca muda nem é reaproveitado (o banco guarda
 *  quem ganhou pelo id). */
export const CONQUISTAS: readonly ConquistaTexto[] = [
  { id: 31, tipo: 'taxa', valor: 1, nome: 'Primeiro real', frase: 'F$ 1 por segundo. Já dá um chiclete.', condicao: 'Produzir F$ 1 por segundo' },
  { id: 32, tipo: 'taxa', valor: 100, nome: 'Pix caindo', frase: 'Já paga o iFood.', condicao: 'Produzir F$ 100 por segundo' },
  { id: 33, tipo: 'taxa', valor: 1e4, nome: 'O leão acordou', frase: 'O contador começou a te ligar.', condicao: 'Produzir F$ 10 mil por segundo' },
  { id: 34, tipo: 'taxa', valor: 1e6, nome: 'Acumulou!', frase: 'Uma Mega da Virada a cada segundo.', condicao: 'Produzir F$ 1 mi por segundo' },
  { id: 35, tipo: 'taxa', valor: 1e9, nome: 'Bilionário de LinkedIn', frase: 'A Forbes mandou e-mail.', condicao: 'Produzir F$ 1 bi por segundo' },
  { id: 36, tipo: 'taxa', valor: 1e12, nome: 'Trilhão por segundo', frase: 'Maior que o PIB, menor que o ego.', condicao: 'Produzir F$ 1 tri por segundo' },
  { id: 37, tipo: 'taxa', valor: 1e15, nome: 'Quatrilhão por segundo', frase: 'Ninguém sabe escrever esse número.', condicao: 'Produzir F$ 1 quatri por segundo' },
  { id: 38, tipo: 'taxa', valor: 1e18, nome: 'Casa da Moeda', frase: 'O dinheiro do mundo acabou. Você imprimiu mais.', condicao: 'Produzir F$ 1 quinti por segundo' },
  { id: 39, tipo: 'era', valor: 2, nome: 'Saiu da casa dos pais', frase: 'A garagem é o novo quarto.', condicao: 'Chegar na era 2 (Garagem)' },
  { id: 40, tipo: 'era', valor: 3, nome: 'Tem até catraca', frase: 'E crachá com foto ruim.', condicao: 'Chegar na era 3 (Escritório)' },
  { id: 41, tipo: 'era', valor: 4, nome: 'Andar inteiro', frase: 'O elevador para só pra você.', condicao: 'Chegar na era 4 (Andar inteiro)' },
  { id: 42, tipo: 'era', valor: 5, nome: 'Sede própria', frase: 'O prédio tem o seu logo.', condicao: 'Chegar na era 5 (Sede)' },
  { id: 43, tipo: 'gerador', alvo: 30, valor: 1, nome: 'Ao infinito e além', frase: 'Do quarto pra Marte.', condicao: 'Ter 1 "Foguete pra Marte"' },
  { id: 44, tipo: 'melhorias', valor: 10, nome: 'Placa de vídeo nova', frase: 'Dez melhorias e o notebook ainda esquenta.', condicao: 'Comprar 10 melhorias' },
  { id: 45, tipo: 'melhorias', valor: 50, nome: 'Coach de produtividade', frase: 'Cinquenta melhorias, zero reuniões.', condicao: 'Comprar 50 melhorias' },
  { id: 46, tipo: 'melhorias', valor: 150, nome: 'Tudo pela família', frase: 'Não tem mais o que melhorar. Ou tem.', condicao: 'Comprar 150 melhorias' },
  { id: 47, tipo: 'oportunidades', valor: 1, nome: 'Black Friday', frase: 'Pegou a primeira.', condicao: 'Pegar 1 oportunidade' },
  { id: 48, tipo: 'oportunidades', valor: 25, nome: 'Caça-promoção', frase: 'Vê desconto de longe.', condicao: 'Pegar 25 oportunidades' },
  { id: 49, tipo: 'oportunidades', valor: 100, nome: 'Oportunista', frase: 'No bom sentido.', condicao: 'Pegar 100 oportunidades' },
  { id: 50, tipo: 'oportunidades', valor: 500, nome: 'Sniper', frase: 'Quinhentas. Você dorme?', condicao: 'Pegar 500 oportunidades' },
  { id: 51, tipo: 'vendas', valor: 1, nome: 'Exit', frase: 'Vendeu a primeira startup.', condicao: 'Vender a startup 1 vez' },
  { id: 52, tipo: 'vendas', valor: 5, nome: 'Empreendedor serial', frase: 'Abre, cresce, vende, repete.', condicao: 'Vender a startup 5 vezes' },
  { id: 53, tipo: 'vendas', valor: 10, nome: 'Unicórnio em série', frase: 'Dez exits no currículo.', condicao: 'Vender a startup 10 vezes' },
  { id: 54, tipo: 'vendas', valor: 25, nome: 'Virou jurado do Shark Tank', frase: 'Vinte e cinco vendas. Já vira palestra.', condicao: 'Vender a startup 25 vezes' },
  { id: 55, tipo: 'contratei', valor: 1, nome: 'Primeira contratação', frase: 'Agora você é chefe.', condicao: 'Contratar 1 vez' },
  { id: 56, tipo: 'contratei', valor: 10, nome: 'O RH sou eu', frase: 'Dez contratos assinados.', condicao: 'Contratar 10 vezes' },
  { id: 57, tipo: 'contratei', valor: 50, nome: 'Headhunter', frase: 'Cinquenta contratações e nenhuma entrevista.', condicao: 'Contratar 50 vezes' },
  { id: 58, tipo: 'contratado', valor: 1, nome: 'Primeiro emprego', frase: 'Carteira assinada (de mentira).', condicao: 'Ser contratado 1 vez' },
  { id: 59, tipo: 'contratado', valor: 10, nome: 'Passe valorizado', frase: 'Dez empresas te quiseram.', condicao: 'Ser contratado 10 vezes' },
  { id: 60, tipo: 'contratado', valor: 50, nome: 'Funcionário do mês, todo mês', frase: 'Cinquenta contratos. Você trabalha?', condicao: 'Ser contratado 50 vezes' },
  { id: 61, tipo: 'estrategia_era', nome: 'Indeciso profissional', frase: 'Já foi de tudo um pouco.', condicao: 'Usar as 3 estratégias de uma era (uma em cada empresa)' },
  { id: 62, tipo: 'estrategia_todas', nome: 'Conhece todos os caminhos', frase: 'Não tem estratégia que você não testou.', condicao: 'Usar todas as estratégias liberadas' },
  // horta do Food truck (0048)
  { id: 63, tipo: 'horta_pix', nome: 'Dinheiro dá em árvore sim', frase: 'Seu pai mentiu pra você.', condicao: 'Plantar o primeiro Pé de Pix' },
  { id: 64, tipo: 'horta_plantou', valor: 100, nome: 'Agro é pop', frase: 'Agro é tech, agro é pop, agro é tudo.', condicao: 'Plantar 100 plantas' },
  { id: 65, tipo: 'horta_colheu', valor: 50, nome: 'Colheita Feliz', frase: 'Saudades de roubar ovo do vizinho no Orkut.', condicao: 'Colher 50 plantas' },
  { id: 66, tipo: 'horta_mandioca', nome: 'Saudando a mandioca', frase: 'Uma das maiores conquistas do Brasil.', condicao: 'Descobrir a Mandioca Turbo' },
  { id: 67, tipo: 'horta_coentro', nome: 'Coentro é bom sim', frase: 'Alguém tinha que defender.', condicao: 'Colher um Coentro' },
  { id: 68, tipo: 'horta_inhame', nome: 'Pai rico, pai pobre', frase: 'Já leu o livro? Ele leu a capa.', condicao: 'Descobrir o Inhame do Primo Rico' },
  { id: 69, tipo: 'horta_abacate', nome: 'Shape inexplicável', frase: 'Treino, dieta e abacate.', condicao: 'Colher um Abacate Proteico' },
  { id: 70, tipo: 'horta_morreu', valor: 10, nome: 'Planta de plástico era melhor', frase: 'Pelo menos ela não julga.', condicao: 'Deixar 10 plantas morrerem de velhas' },
  { id: 71, tipo: 'horta_colecao', valor: 8, nome: 'Temos que plantar', frase: 'Ash Ketchum da roça.', condicao: 'Descobrir as 8 plantas da horta' },
  { id: 72, tipo: 'gerador', alvo: 11, valor: 200, nome: 'Fazendinha do Facebook', frase: 'Convida os amigos pra regar.', condicao: 'Ter 200 "Food truck" (horta 6 × 6)' },
  // convidados do PPP Podcast (0051)
  { id: 73, tipo: 'conv_sentou', nome: 'Tá gravando?', frase: 'Episódio 1: 40 minutos arrumando o microfone.', condicao: 'Sentar o primeiro convidado' },
  { id: 74, tipo: 'conv_mesa', nome: 'Mesacast', frase: 'Três convidados, um microfone funcionando e zero pauta.', condicao: 'Ter as 3 cadeiras ocupadas' },
  { id: 75, tipo: 'conv_vistos', valor: 11, nome: 'Todo mundo já sentou aqui', frase: 'Até o Kojima chegou no horário.', condicao: 'Sentar os 11 convidados ao menos uma vez' },
  { id: 76, tipo: 'conv_cr', nome: 'Água!', frase: 'Afastou duas Coca-Colas e a marca perdeu 4 bilhões. Respeita.', condicao: 'Sentar o Cristiano Ronaldo na cadeira da frente' },
  { id: 77, tipo: 'conv_fgc', nome: 'O FGC não cobre', frase: 'Rendia 140% do CDI. Rendia.', condicao: 'Ter uma ação do Vorcaro virando pó' },
  { id: 78, tipo: 'conv_kojima', nome: 'Que geometria', frase: 'Ficou 24 h no estúdio e entregou uma encomenda.', condicao: 'Deixar o Kojima 24 h sentado' },
  { id: 79, tipo: 'conv_hl3', nome: 'Half-Life 3 confirmado', frase: 'Ele finalmente contou até 3.', condicao: 'Sentar o Gabe Newell na 3ª cadeira' },
  { id: 80, tipo: 'conv_derrubada', valor: 1, nome: 'Sample não liberado', frase: 'Lost media brasileira.', condicao: 'Ter uma faixa do MC V.V derrubada por copyright' },
  { id: 81, tipo: 'conv_toby', nome: 'Já já sai o Chapter 5', frase: 'Ficou 20 horas esperando. O Toby também.', condicao: 'Deixar o Toby Fox 20 h sentado sem trocar' },
  { id: 82, tipo: 'opp_dia', valor: 15, nome: 'Receba!', frase: 'Obrigado meu Deus, obrigado meu pai.', condicao: 'Pegar 15 oportunidades num dia' },
  { id: 101, escondida: true, tipo: 'gerador_exato', valor: 67, nome: '6-7', frase: 'Seis sete. Ninguém sabe por quê.', condicao: 'Ter exatamente 67 de algum gerador' },
  { id: 102, escondida: true, tipo: 'aura', nome: 'Farmou aura', frase: '+1000 de aura.', condicao: 'Ficar em 1º no placar' },
  { id: 103, escondida: true, tipo: 'aura_negativa', nome: 'Aura negativa', frase: 'Vendeu por um real e um abraço.', condicao: 'Vender a startup e ganhar só 1 ponto' },
  { id: 105, escondida: true, tipo: 'jaula', valor: 100, nome: 'Tá saindo da jaula', frase: 'Birl! O monstro tá saindo da jaula.', condicao: 'Levar 100 ou mais de uma vez no Máx' },
  { id: 106, escondida: true, tipo: 'melhoria', alvo: 283, nome: 'Guiana Brasileira', frase: 'Fala galera! A Guiana Brasileira agora tem sede.', condicao: 'Comprar "Filial em Portugal"' },
  { id: 107, escondida: true, tipo: 'gerador', alvo: 7, valor: 50, nome: 'Fez o L', frase: 'L de Luis, que fique claro.', condicao: 'Ter 50 "Estagiário"' },
  { id: 108, escondida: true, tipo: 'madrugada', nome: '3h06', frase: 'Bora fundar uma empresa?', condicao: 'Abrir a Fellas Inc. entre 3h e 4h da manhã' },
  { id: 109, escondida: true, tipo: 'sigma', nome: 'Modo sigma', frase: 'Lobo solitário do empreendedorismo.', condicao: 'Vender a startup sem nunca ter contratado ninguém' },
  { id: 110, escondida: true, tipo: 'unicornio', nome: 'Pai tá on', frase: 'O pai tá on.', condicao: 'Ser o unicórnio da semana' },
  { id: 111, escondida: true, tipo: 'brainrot', valor: 60, nome: 'Brainrot', frase: 'Tung tung tung empreendedor.', condicao: 'Pegar 3 oportunidades em menos de 1 minuto' },
  { id: 112, escondida: true, tipo: 'horta_morango', nome: 'Ele tem pescoço sim', frase: 'Você viu com seus próprios olhos.', condicao: 'Ver um Morango com Pescoço brotar' },
  { id: 113, escondida: true, tipo: 'conv_mesma', nome: 'São a mesma pessoa?', frase: 'Nunca foram vistos juntos.', condicao: 'Tentar sentar o Gemaplys e o MC V.V juntos' },
];

/** Ramos da árvore de habilidades: 0 é a raiz; 1 a 5 são os ramos. */
export const RAMOS: readonly string[] = ['Raiz', 'Produção', 'Recomeço', 'Oportunidades', 'Tempo', 'Gente'];

/** O que cada nó faz. Valor: multiplicador (producao, opp_bonus, contrato_preco, emprego_mult), horas (teto), segundos (segundos: quanto a oportunidade fica na cena),
 *  quantidade (caixinha, opp_extra, inicio_notebooks, contrato_dias), reais (inicio_valuation), fração (por_contratado)
 *  ou 1 (inicio_era1, manter_gerais: só ter o nó). */
export type TipoNo =
  | 'producao' | 'inicio_valuation' | 'inicio_notebooks' | 'manter_gerais' | 'inicio_era1'
  | 'caixinha' | 'segundos' | 'opp_extra' | 'opp_bonus' | 'teto'
  | 'contrato_preco' | 'por_contratado' | 'contrato_dias' | 'emprego_mult';

export type NoTexto = { ramo: number; posicao: number; nome: string; efeito: string; tipo: TipoNo; valor: number };

/** A árvore de habilidades, na ordem: a raiz e os 5 ramos de 5 nós. id = ramo·10 + posição (a raiz é 1). Nó novo ou
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
  { ramo: 4, posicao: 1, tipo: 'teto', valor: 12, nome: 'Soneca pós-almoço', efeito: 'A empresa rende até 12h com o jogo fechado.' },
  { ramo: 4, posicao: 2, tipo: 'teto', valor: 16, nome: 'Ponto facultativo', efeito: 'Rende até 16h com o jogo fechado.' },
  { ramo: 4, posicao: 3, tipo: 'teto', valor: 24, nome: 'Feriado prolongado', efeito: 'Rende até 24h com o jogo fechado.' },
  { ramo: 4, posicao: 4, tipo: 'teto', valor: 36, nome: 'Feriadão emendado', efeito: 'Rende até 36h com o jogo fechado.' },
  { ramo: 4, posicao: 5, tipo: 'teto', valor: 48, nome: 'Carnaval', efeito: 'Rende até 48h com o jogo fechado.' },
  { ramo: 5, posicao: 1, tipo: 'contrato_preco', valor: 0.75, nome: 'Placa de "Precisa-se"', efeito: 'Contratar custa 25% menos.' },
  { ramo: 5, posicao: 2, tipo: 'por_contratado', valor: 0.15, nome: 'Aniversariante do mês', efeito: 'Seus contratados rendem 15% (no lugar de 10%).' },
  { ramo: 5, posicao: 3, tipo: 'contrato_dias', valor: 10, nome: 'Carteira assinada', efeito: 'Os contratos que você faz duram 10 dias.' },
  { ramo: 5, posicao: 4, tipo: 'emprego_mult', valor: 2, nome: 'Passe de craque', efeito: 'Quem te contrata rende o dobro pra você.' },
  { ramo: 5, posicao: 5, tipo: 'contrato_preco', valor: 0.5, nome: 'Jovem Aprendiz', efeito: 'Contratar custa 50% menos.' },
];
