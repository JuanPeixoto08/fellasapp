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
  ['Escritório no arranha-céu', 'Carro de luxo da firma', 'Visto de negócios', 'Parceiro xeique', 'Torre própria'],
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
