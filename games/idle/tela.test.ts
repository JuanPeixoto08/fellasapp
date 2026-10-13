// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { IdleBoardRow, IdleState } from '../shared/types';
import type { Desenhar } from './navegador';
import { instante, sai, tipo, VALIDADE_S } from './oportunidades';
import { ativos } from './ativos';
import { catalogo } from './catalogo';
import { PADRAO } from './personagem';
import { NOVIDADES } from './novidades';
import { criarTela, empresas, porcento, prazo, restam, type Acoes, type Modelo } from './tela';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10, promo_ate: null, viral: [],
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});
const modelo = (x: Partial<Modelo> = {}): Modelo => ({
  fase: 'jogando', estado: estado(), aba: 'loja', placar: null, aviso: null, ocupado: false, pendentes: [], aoVivo: null, caixaAberta: false, editor: null, placarFalhou: false,
  vendaAberta: false, conquistaAviso: null, bolsa: null, bolsaAberta: false, config: 'fechada', volumeMusica: 1, chaves: { efeitos: true, avisos: true }, novidadeNova: false, horta: null, hortaAberta: false, convidadosAberto: false, ...x,
});

let acoes: { [K in keyof Acoes]: Mock<Acoes[K]> };
let root: HTMLElement;
beforeEach(() => {
  // por padrão, sem mouse (celular): tocar na conquista abre o detalhe; o teste do PC troca isso
  window.matchMedia = ((q: string) => ({ matches: false, media: q }) as MediaQueryList) as typeof window.matchMedia;
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  acoes = {
    abrirCnpj: vi.fn<Acoes['abrirCnpj']>(), comprar: vi.fn<Acoes['comprar']>(), escolher: vi.fn<Acoes['escolher']>(), pegar: vi.fn<Acoes['pegar']>(),
    trocarAba: vi.fn<Acoes['trocarAba']>(), caixa: vi.fn<Acoes['caixa']>(), tentarDeNovo: vi.fn<Acoes['tentarDeNovo']>(),
    contratar: vi.fn<Acoes['contratar']>(), editor: vi.fn<Acoes['editor']>(), mudarVisual: vi.fn<Acoes['mudarVisual']>(),
    vender: vi.fn<Acoes['vender']>(), comprarNo: vi.fn<Acoes['comprarNo']>(),
    bolsa: vi.fn<Acoes['bolsa']>(), negociar: vi.fn<Acoes['negociar']>(), melhorar: vi.fn<Acoes['melhorar']>(),
    config: vi.fn<Acoes['config']>(), chave: vi.fn<Acoes['chave']>(), efeito: vi.fn<Acoes['efeito']>(), volumeMusica: vi.fn<Acoes['volumeMusica']>(), pegarDourado: vi.fn<Acoes['pegarDourado']>(),
    horta: vi.fn<Acoes['horta']>(), plantar: vi.fn<Acoes['plantar']>(), colher: vi.fn<Acoes['colher']>(), arrancar: vi.fn<Acoes['arrancar']>(),
    convidados: vi.fn<Acoes['convidados']>(), sentar: vi.fn<Acoes['sentar']>(), tirar: vi.fn<Acoes['tirar']>(),
  };
});
const porTexto = (texto: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === texto)!;

describe('tela da Fellas Inc.', () => {
  it('caixinha de informação: mouse no gerador mostra quanto ele rende; segue a linha quando a tela refaz', () => {
    vi.useFakeTimers();
    try {
      const tela = criarTela(root, acoes);
      const s = estado({ generators: [12, ...Array(29).fill(0)], rate: 6 });
      tela.renderizar(modelo({ estado: s }));
      const linha = () => root.querySelector<HTMLElement>('.lista-geradores .gerador')!;
      linha().dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      vi.advanceTimersByTime(200);
      const dica = root.querySelector<HTMLElement>('.dica')!;
      expect(dica.hasAttribute('hidden')).toBe(false);
      expect(dica.querySelector('strong')!.textContent).toBe(catalogo.geradores[0].nome);
      expect(dica.textContent).toContain('Os 12 rendem');
      tela.renderizar(modelo({ estado: estado({ generators: [13, ...Array(29).fill(0)], rate: 6.5 }) }));
      expect(dica.hasAttribute('hidden')).toBe(false);
      expect(dica.textContent).toContain('Os 13 rendem');
      tela.renderizar(modelo({ estado: s, aba: 'placar' }));
      expect(dica.hasAttribute('hidden')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('PC grande: a página ganha zoom e o --zoom (o que usa dvh divide por ele); celular fica sem', () => {
    const [w, h] = [window.innerWidth, window.innerHeight];
    try {
      Object.assign(window, { innerWidth: 1920, innerHeight: 960 });
      criarTela(root, acoes);
      const app = root.querySelector<HTMLElement>('.app')!;
      expect(Number(app.style.getPropertyValue('--zoom'))).toBeCloseTo(4 / 3);
      expect(app.style.getPropertyValue('--cena-w')).toBe('600px'); // 5× = 800 na tela
      Object.assign(window, { innerWidth: 390, innerHeight: 760 });
      window.dispatchEvent(new Event('resize'));
      expect(app.style.getPropertyValue('--zoom')).toBe('');
    } finally {
      Object.assign(window, { innerWidth: w, innerHeight: h });
    }
  });
  it('antes: só o Abrir CNPJ', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    porTexto('Abrir CNPJ').click();
    expect(acoes.abrirCnpj).toHaveBeenCalled();
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(true);
  });
  it('Loja: gerador ligado a uma empresa da Bolsa mostra a etiqueta só com a Bolsa aberta (1 Grupo de trader)', () => {
    const tela = criarTela(root, acoes);
    const gens = (trader: number) => [1, ...Array(10).fill(1), 0, 0, 0, 0, 0, 0, 0, trader, ...Array(11).fill(0)];
    tela.renderizar(modelo({ estado: estado({ generators: gens(0) }) }));
    expect(root.querySelector('.etq-bolsa')).toBeNull();
    tela.renderizar(modelo({ estado: estado({ generators: gens(1) }) }));
    const etqs = [...root.querySelectorAll('.etq-bolsa')];
    expect(etqs.map((e) => e.textContent)).toEqual(['Bolsa: +1 MEME cada', 'Bolsa: +1 SIMA cada', 'Bolsa: +1 PSTL cada']); // 6, 8 e 11
    expect(etqs[2].getAttribute('title')).toBe('Cada Food truck libera +1 ação do Pastel do Zé na Bolsa');
  });
  it('oportunidade nova: a Caixinha da bancada pula e brilha por uns 2 s (o "plim" não fica sem nada na tela)', () => {
    vi.useFakeTimers();
    try {
      const tela = criarTela(root, acoes);
      tela.renderizar(modelo());
      const caixa = root.querySelector<HTMLElement>('.bancada-caixa')!;
      tela.chegouOportunidade();
      expect(caixa.classList.contains('chegou')).toBe(true);
      tela.renderizar(modelo()); // re-render no meio não corta o pulo
      expect(caixa.classList.contains('chegou')).toBe(true);
      vi.advanceTimersByTime(2200);
      expect(caixa.classList.contains('chegou')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it('porta Horta: apagada sem Food truck; aberta mostra a horta em tela cheia; Voltar fecha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const porta = root.querySelector<HTMLButtonElement>('.gaveta-horta')!;
    expect(porta.classList.contains('trancada')).toBe(true);
    expect(porta.textContent).toContain('Compra 1 Food truck pra abrir');
    porta.click();
    expect(acoes.horta).toHaveBeenCalledWith('abrir');
    const comFT = estado({ generators: [1, ...Array(9).fill(0), 3, ...Array(19).fill(0)] });
    const horta = { lado: 2, food_trucks: 3, plantas: [], descobertas: [1, 2], bonus: { producao: 0, geradores: 0, melhorias: 0, oportunidades: 0 }, server_now: comFT.server_now };
    tela.renderizar(modelo({ estado: comFT, hortaAberta: true, horta }));
    expect(porta.classList.contains('trancada')).toBe(false);
    expect(porta.textContent).toContain('coleção 2/8');
    expect(porta.textContent).toContain('4 vazios');
    const cheia = root.querySelector<HTMLElement>('.minigame-tela')!;
    expect(cheia.hasAttribute('hidden')).toBe(false);
    expect(cheia.querySelector('.minigame-corpo .horta-grade')).not.toBeNull();
    expect(cheia.querySelector('h2')!.textContent).toBe('Horta do Food truck');
    [...cheia.querySelectorAll('button')].find((x) => x.textContent === '← Voltar')!.click();
    expect(acoes.horta).toHaveBeenLastCalledWith('fechar');
    tela.renderizar(modelo({ estado: comFT, horta }));
    expect(cheia.hasAttribute('hidden')).toBe(true);
  });
  it('as portas: Bolsa, Horta, Convidados, Lives e Mapa do rolê (os dois últimos em breve)', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const portas = [...root.querySelectorAll<HTMLButtonElement>('.portas .porta')];
    expect(portas.map((p) => p.querySelector('.porta-nome')!.textContent)).toEqual(['Bolsa', 'Horta', 'Convidados', 'Lives', 'Mapa do rolê']);
    expect(portas.slice(3).every((p) => p.disabled && p.textContent!.includes('Em breve'))).toBe(true);
  });
  it('os descontos da horta entram nos preços da Loja', () => {
    const tela = criarTela(root, acoes);
    const preco1 = () => root.querySelector<HTMLButtonElement>('.gerador button[data-qtd="1"]')!.textContent;
    tela.renderizar(modelo({ estado: estado({ valuation: 0 }) }));
    const cheio = preco1();
    tela.renderizar(modelo({ estado: estado({ valuation: 0, horta_bonus: { producao: 0, geradores: 0.5, melhorias: 0, oportunidades: 0 } }) }));
    tela.renderizar(modelo({ estado: estado({ half_price: true }) }));
    const metade = preco1();
    tela.renderizar(modelo({ estado: estado({ horta_bonus: { producao: 0, geradores: 0.5, melhorias: 0, oportunidades: 0 } }) }));
    expect(preco1()).toBe(metade);
    expect(preco1()).not.toBe(cheio);
  });
  it('a oportunidade não passa mais na cena (fica só na Caixinha)', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aoVivo: 3 }));
    expect(root.querySelector('.palco .vivo')).toBeNull();
  });
  it('eventos na tela: o clique chama pegarDourado; o selo do bônus mostra o tempo que falta', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const T = Date.parse('2026-10-12T12:00:00.000Z');
    tela.dourados.mostrar({ seg: T / 1000, lado: 0, tipo: 2, x: 0.5, y: 0.5, agoraMs: T });
    root.querySelector<HTMLButtonElement>('.dourado')!.click();
    expect(acoes.pegarDourado).toHaveBeenCalledWith(T / 1000, 0);
    const em = (s: number) => new Date(T + s * 1000).toISOString();
    tela.relogioBonus(estado({ viral: [em(15), em(55)], promo_ate: em(21) }), T);
    const selos = [...root.querySelectorAll('.selo-bonus')];
    expect(selos.map((s) => s.textContent)).toEqual(['×100 · 0:15', 'Metade · 0:21']);
    expect(selos[0].classList.contains('ouro')).toBe(true);
    tela.relogioBonus(estado(), T);
    expect(root.querySelectorAll('.selo-bonus')).toHaveLength(0);
  });
  it('Promoção valendo: os preços da Loja saem pela metade (e a meia-preço da Caixinha não soma)', () => {
    const tela = criarTela(root, acoes);
    const agora = Date.parse('2026-10-12T12:00:00.000Z');
    const preco1 = () => root.querySelector<HTMLButtonElement>('.gerador button[data-qtd="1"]')!.textContent;
    tela.renderizar(modelo({ agora }));
    const cheio = preco1();
    tela.renderizar(modelo({ agora, estado: estado({ promo_ate: new Date(agora + 20_000).toISOString() }) }));
    const promo = preco1();
    tela.renderizar(modelo({ agora, estado: estado({ half_price: true }) }));
    expect(promo).toBe(preco1()); // Promoção sozinha = meia-preço sozinha
    expect(promo).not.toBe(cheio);
    tela.renderizar(modelo({ agora, estado: estado({ promo_ate: new Date(agora + 20_000).toISOString(), half_price: true }) }));
    expect(preco1()).toBe(promo); // as duas juntas não viram um quarto
    tela.renderizar(modelo({ agora, estado: estado({ promo_ate: new Date(agora - 1000).toISOString() }) }));
    expect(preco1()).toBe(cheio); // acabou
  });
  it('lista o gerador 1 e o próximo trancado; botão libera quando o valor chega no preço', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const linhas = root.querySelectorAll('.gerador');
    expect(linhas).toHaveLength(3); // 1 (tem), 2 (liberado: tem o 1), 3 (trancado)
    expect(linhas[2].textContent).toContain('Compra 1 "Post motivacional no LinkedIn" pra liberar');
    const comprar1 = linhas[0].querySelector<HTMLButtonElement>('button[data-qtd="1"]')!;
    tela.atualizarValor(17);
    expect(comprar1.disabled).toBe(true);
    tela.atualizarValor(17.25);
    expect(comprar1.disabled).toBe(false);
    comprar1.click();
    expect(acoes.comprar).toHaveBeenCalledWith('gerador', 1, 1);
  });
  it('era nova sem estratégia: cartões, os desligados avisam o porquê', () => {
    const tela = criarTela(root, acoes);
    const g = [...Array(13).fill(1), ...Array(17).fill(0)];
    tela.renderizar(modelo({ estado: estado({ era: 3, generators: g, strategies: [0, -1, -1, -1] }) }));
    const modal = root.querySelector('.modal-estrategia')!;
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect(modal.textContent).toContain('Chega com o Mapa do rolê');
    [...modal.querySelectorAll('button')].find((b) => b.textContent === 'Escolher' && !b.disabled)!.click();
    expect(acoes.escolher).toHaveBeenCalledWith(3, 0);
  });
  it('aviso aparece; a Caixinha da bancada mostra quantas tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aviso: 'Valuation não cobre essa compra', pendentes: [3, 2] }));
    expect(root.querySelector('.notice')!.textContent).toContain('Valuation não cobre essa compra');
    expect(root.querySelector('.bancada-caixa .selo')!.textContent).toBe('2');
    expect(root.querySelector('.caixinha')).toBeNull();
  });
  it('caixinha: com uma meia-preço guardada, outra meia-preço fica apagada com o aviso; os outros tipos não', () => {
    const uid = '00000000-0000-0000-0000-00000000000a';
    const janela = (k: 0 | 1 | 2) => { let w = 50; while (tipo(uid, w) !== k) w++; return w; };
    const meia = janela(2);
    const outra = janela(0);
    const tela = criarTela(root, acoes);
    const linhas = (half: boolean) => {
      tela.renderizar(modelo({ caixaAberta: true, pendentes: [meia, outra], estado: estado({ user_id: uid, half_price: half }) }));
      return [...root.querySelectorAll('.modal-caixa .escolha')];
    };
    const [m1, o1] = linhas(true);
    expect(m1.querySelector('button')!.disabled).toBe(true);
    expect(m1.textContent).toContain('Usa a que você já tem primeiro');
    expect(o1.querySelector('button')!.disabled).toBe(false);
    const [m2] = linhas(false);
    expect(m2.querySelector('button')!.disabled).toBe(false);
    expect(m2.textContent).not.toContain('Usa a que você já tem primeiro');
  });
  it('caixinha: uma linha por oportunidade com o boneco, o prazo e Pegar; X fecha; sem pega no dia, botões apagados', () => {
    vi.useFakeTimers();
    const uid = '00000000-0000-0000-0000-00000000000a';
    const agora = instante(uid, 50) + 5 * 60 * 1000; // 5 min depois de a janela 50 aparecer
    vi.setSystemTime(agora);
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ caixaAberta: true, pendentes: [50], estado: estado({ user_id: uid }) }));
    const linha = root.querySelector('.modal-caixa .escolha')!;
    expect((linha.querySelector('.boneco') as HTMLElement).style.backgroundImage).toContain('url(');
    // sai quando aparece a 3ª mais nova (janela 53), bem antes das 4h
    expect(linha.querySelector('.prazo')!.textContent).toBe(prazo(instante(uid, 53) - agora));
    expect(linha.querySelector('.prazo')!.textContent).not.toMatch(/h/);
    linha.querySelector('button')!.click();
    expect(acoes.pegar).toHaveBeenCalledWith(50);
    root.querySelector<HTMLButtonElement>('.modal-caixa .fechar')!.click();
    expect(acoes.caixa).toHaveBeenCalledWith(false);
    tela.renderizar(modelo({ caixaAberta: true, pendentes: [50], estado: estado({ user_id: uid, opp_left: 0 }) }));
    expect(root.querySelector('.modal-caixa')!.textContent).toContain('Já pegou todas de hoje. Amanhã tem mais.');
    expect(root.querySelector<HTMLButtonElement>('.modal-caixa .escolha button')!.disabled).toBe(true);
    vi.useRealTimers();
  });
  it('prazo: horas com minutos, minutos, menos de 1 min', () => {
    expect(prazo(VALIDADE_S * 1000)).toBe('Some em 4h00');
    expect(prazo((3 * 60 + 12) * 60000)).toBe('Some em 3h12');
    expect(prazo(40 * 60000)).toBe('Some em 40 min');
    expect(prazo(30000)).toBe('Some em menos de 1 min');
  });
  it('melhorias: Compradas mostra as que você já tem, da mais recente pra mais antiga, sem botão de compra', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ estado: estado({ upgrades: [1001, 1002] }) }));
    porTexto(root.querySelector('.seg-loja button:last-child')!.textContent!).click();
    porTexto('Compradas (2)').click();
    const itens = [...root.querySelectorAll('.lista-melhorias .melhoria')];
    expect(itens.map((x) => x.querySelector('strong')!.textContent)).toEqual(['Wi-Fi do vizinho', 'Café coado na hora']);
    expect(itens.every((x) => !x.querySelector('.btn'))).toBe(true);
    expect(porTexto('Compradas (2)').getAttribute('aria-pressed')).toBe('true');
    porTexto(root.querySelector('.lista-melhorias .seg button')!.textContent!).click();
    expect(root.querySelector('.lista-melhorias')!.textContent).not.toContain('Wi-Fi do vizinho');
  });
  it('placar mostra o F$/s de cada um, não o valuation', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [{ userId: 'b', name: 'Bia', valuation: 9e9, rate: 1234.5, era: 3, strategies: [0, -1, -1, -1], avatar: null, hiredCount: 0, byMe: false, mostHired: false, pontos: 0, conquistas: 0 }] }));
    const v = root.querySelector('.lista-placar .v')!.textContent!;
    expect(v).toContain('/s');
    expect(v).not.toContain('bi');
    expect(root.querySelector('.lista-placar .sub')!.textContent).toBe('Era 3 · Escritório');
  });
  it('placar ainda não carregado: Carregando…', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: null }));
    const lista = root.querySelector('.lista-placar')!;
    expect(lista.hasAttribute('hidden')).toBe(false);
    expect(lista.textContent).toBe('Carregando…');
  });
  it('fatal: botão de tentar de novo, sem o Entrar', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'carregando', estado: null }));
    tela.fatal('Deu ruim');
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.hasAttribute('hidden')).toBe(false);
    expect(overlay.textContent).toContain('Deu ruim');
    expect([...overlay.querySelectorAll('button')].find((b) => b.textContent === 'Tentar de novo')!.hasAttribute('hidden')).toBe(false);
    expect(overlay.querySelector('a')!.hasAttribute('hidden')).toBe(true);
  });
  it('sem sessão: Entrar, sem o tentar de novo do fatal', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'sem_sessao', estado: null }));
    const overlay = root.querySelector<HTMLElement>('.overlay')!;
    expect(overlay.querySelector('a')!.hasAttribute('hidden')).toBe(false);
    expect(overlay.querySelector('button')!.hasAttribute('hidden')).toBe(true);
  });
  it('modais com aria-modal e título', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({
      estado: estado({ era: 2, generators: [1, 1, 1, 1, 1, 1, 1, ...Array(23).fill(0)], pontos_venda: 1 }),
      caixaAberta: true, editor: { ...PADRAO }, vendaAberta: true,
    }));
    for (const sel of ['.modal-estrategia', '.modal-caixa', '.modal-visual', '.modal-venda']) {
      const modal = root.querySelector(sel)!;
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(root.querySelector(`#${modal.getAttribute('aria-labelledby')}`)!.tagName).toBe('H2');
    }
  });
});

const linha = (x: Partial<IdleBoardRow> = {}): IdleBoardRow => ({
  userId: 'b', name: 'Bia', valuation: 1000, rate: 2, era: 2, strategies: [0, -1, -1, -1],
  avatar: null, hiredCount: 0, byMe: false, mostHired: false, pontos: 0, conquistas: 0, ...x,
});
const ATE = '2026-10-19T00:00:00.000Z'; // 6,5 dias depois do server_now das fixtures

describe('contratar', () => {
  it('cartas de quem abriu a empresa (menos você); botão libera no preço; tocar contrata', () => {
    const desenhar = vi.fn<Desenhar>();
    const tela = criarTela(root, acoes, desenhar);
    tela.renderizar(modelo({ aba: 'gente', estado: estado({ hire_price: 918 }), placar: [linha({ userId: 'u', name: 'Você' }), linha()] }));
    const cartas = root.querySelectorAll('.lista-contratar .carta');
    expect(cartas).toHaveLength(1);
    expect(cartas[0].textContent).toContain('Bia');
    expect(cartas[0].textContent).toContain('Garagem · ninguém contratou ainda');
    const b = cartas[0].querySelector('button')!;
    expect(b.textContent).toBe('Contratar · F$ 918');
    tela.atualizarValor(917);
    expect(b.disabled).toBe(true);
    tela.atualizarValor(918);
    expect(b.disabled).toBe(false);
    b.click();
    expect(acoes.contratar).toHaveBeenCalledWith('b');
    expect(desenhar).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), PADRAO, undefined); // sem visual = fundador
  });
  it('quem você já contratou: sem botão, com o cargo e quanto falta pro contrato vencer', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({
      aba: 'gente',
      estado: estado({ equipe: [{ user_id: 'b', cargo: 'CEO de nada', avatar: null, ate: ATE }] }),
      placar: [linha({ byMe: true, hiredCount: 1 })],
    }));
    const carta = root.querySelector('.lista-contratar .carta')!;
    expect(carta.querySelector('button')).toBeNull();
    expect(carta.textContent).toContain('Trabalha pra você como CEO de nada por mais 6 dias');
    expect(carta.textContent).toContain('trabalha em 1 empresa');
  });
  it('topo: bônus dos contratos, piso de freela ou quem te contratou; Mudar visual abre o editor; vazio convida', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'gente', placar: [] }));
    const topo = root.querySelector('.contratos-topo')!;
    expect(topo.textContent).toContain('Contratos: +2% de produção');
    expect(topo.textContent).toContain('Ninguém te contratou: você ganha o piso de freela.');
    expect(root.querySelector('.lista-contratar')!.textContent).toContain('Ninguém mais abriu a empresa ainda. Chama a galera.');
    [...topo.querySelectorAll('button')].find((x) => x.textContent === 'Mudar visual')!.click();
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
    tela.renderizar(modelo({
      aba: 'gente', placar: [linha()],
      estado: estado({ chefes: [{ user_id: 'b', cargo: 'sócio de fachada', mult: 1, ate: ATE }], social: { contratei: 0, empregos: [1] } }),
    }));
    expect(root.querySelector('.contratos-topo')!.textContent).toContain('Você trabalha pra Bia (sócio de fachada, por mais 6 dias).');
  });
  it('placar: boneco de cada um e o mais disputado do mercado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [linha({ mostHired: true, hiredCount: 3 }), linha({ userId: 'c', name: 'Teteu' })] }));
    const itens = root.querySelectorAll('.lista-placar li');
    expect(itens[0].querySelector('canvas')).not.toBeNull();
    expect(itens[0].textContent).toContain('Mais disputado da semana');
    expect(itens[1].textContent).not.toContain('Mais disputado');
  });
  it('porcento, empresas e restam', () => {
    expect(porcento(1.02)).toBe('+2%');
    expect(porcento(1.12)).toBe('+12%');
    expect(porcento(1.025)).toBe('+2,5%');
    expect(empresas(0)).toBe('ninguém contratou ainda');
    expect(empresas(1)).toBe('trabalha em 1 empresa');
    expect(empresas(3)).toBe('trabalha em 3 empresas');
    expect(restam(6.5 * 86400_000)).toBe('por mais 6 dias');
    expect(restam(30 * 3600_000)).toBe('por mais 1 dia');
    expect(restam(5.5 * 3600_000)).toBe('por mais 5 h');
    expect(restam(20 * 60_000)).toBe('por menos de 1 h');
  });
});

describe('placar que falhou', () => {
  it('Contratar e Placar mostram o erro em vez de Carregando… pra sempre', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'gente', placar: null }));
    expect(root.querySelector('.lista-contratar')!.textContent).toContain('Carregando…');
    tela.renderizar(modelo({ aba: 'gente', placar: null, placarFalhou: true }));
    expect(root.querySelector('.lista-contratar')!.textContent).toContain('Não deu pra carregar a galera. Tenta de novo.');
    tela.renderizar(modelo({ aba: 'placar', placar: null, placarFalhou: true }));
    expect(root.querySelector('.lista-placar')!.textContent).toContain('Não deu pra carregar a galera. Tenta de novo.');
  });
});

describe('editor de personagem', () => {
  const grupo = (nome: string) => root.querySelector<HTMLElement>(`.modal-visual [role="group"][aria-label="${nome}"]`);
  it('mostra o rascunho marcado; tocar muda; a cor da cabeça some com "Nada"', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }), editor: { ...PADRAO } }));
    expect(root.querySelector('.modal-visual')!.hasAttribute('hidden')).toBe(false);
    expect(grupo('Cor do cabelo')!.querySelector('[aria-label="Preto"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(grupo('Na cabeça')!.querySelector('[aria-pressed="true"]')!.textContent).toBe('Fone');
    [...grupo('Cabelo')!.querySelectorAll('button')].find((x) => x.textContent === 'Cacheado')!.click();
    expect(acoes.mudarVisual).toHaveBeenCalledWith('cabelo', 2);
    expect(grupo('Cor do que vai na cabeça')).not.toBeNull();
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }), editor: { ...PADRAO, acessorio: 0 } }));
    expect(grupo('Cor do que vai na cabeça')).toBeNull();
  });
  it('Sortear, Bora e fechar chamam o editor; Bora apagado enquanto salva', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ editor: { ...PADRAO } }));
    const modal = root.querySelector('.modal-visual')!;
    [...modal.querySelectorAll('button')].find((x) => x.textContent === 'Sortear')!.click();
    [...modal.querySelectorAll('button')].find((x) => x.textContent === 'Bora')!.click();
    modal.querySelector<HTMLButtonElement>('.fechar')!.click();
    expect(acoes.editor.mock.calls.map((c) => c[0])).toEqual(['sortear', 'salvar', 'fechar']);
    tela.renderizar(modelo({ editor: { ...PADRAO }, ocupado: true }));
    expect([...root.querySelectorAll<HTMLButtonElement>('.modal-visual button')].find((x) => x.textContent === 'Bora')!.disabled).toBe(true);
  });
  it('fechado: modal escondido; "Mudar visual" na tela de abrir a empresa abre', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    expect(root.querySelector('.modal-visual')!.hasAttribute('hidden')).toBe(true);
    [...root.querySelectorAll<HTMLButtonElement>('.abrir button')].find((x) => x.textContent === 'Mudar visual')!.click();
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
  });
});

describe('legado: prestígio, árvore e conquistas', () => {
  const EM = '2026-10-12T15:00:00.000Z';
  it('pontos: livres, na vida e recorde; sem ponto a ganhar, "Ainda não compensa" apagado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos: 3, pontos_vida: 12, vendas: 2, recorde: 1234.5 }) }));
    const topo = root.querySelector('.legado-pontos')!;
    expect(topo.querySelector('.legado-num')!.textContent).toBe('★ 3 pontos');
    expect(topo.textContent).toContain('12 na vida · recorde +F$ 1,23 mil/s · vendeu 2 vezes');
    const b = topo.querySelector('button')!;
    expect(b.textContent).toBe('Ainda não compensa');
    expect(b.disabled).toBe(true);
  });
  it('vender: o botão diz quantos pontos e abre a folha; a folha confirma ou fecha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 5 }) }));
    const b = root.querySelector<HTMLButtonElement>('.legado-pontos button')!;
    expect(b.textContent).toBe('Vender · +5 ★');
    expect(b.getAttribute('aria-label')).toBe('Vender a startup e ganhar 5 pontos');
    b.click();
    expect(acoes.vender).toHaveBeenCalledWith('abrir');
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 5 }), vendaAberta: true }));
    const folha = root.querySelector('.modal-venda')!;
    expect(folha.hasAttribute('hidden')).toBe(false);
    expect(folha.textContent).toContain('Você ganha 5 pontos pra gastar na árvore e recomeça do zero.');
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Vender')!.click();
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Deixa quieto')!.click();
    expect(acoes.vender.mock.calls.map((c) => c[0])).toEqual(['abrir', 'confirmar', 'fechar']);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 0 }), vendaAberta: true }));
    expect(root.querySelector('.modal-venda')!.hasAttribute('hidden')).toBe(true);
  });
  it('quadro da árvore: miniatura, quantos comprou e quantos dá pra comprar; Abrir mostra a árvore', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }) }));
    const quadro = root.querySelector('.arvore-quadro')!;
    expect(quadro.querySelector('svg.arvore-mini')).not.toBeNull();
    expect(quadro.textContent).toContain(`2 de ${catalogo.arvore.length} comprados · 5 dá pra comprar agora`); // o 1º de cada um dos outros 5 ramos (2 pontos cada; o 12 custa 4)
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(true);
    quadro.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(false);
    root.querySelector<HTMLButtonElement>('.arvore-cartao button')!.click();
    expect(acoes.comprarNo).toHaveBeenCalledWith(21);
  });
  it('árvore aberta: redesenhar mantém aberta e o foco volta pro Abrir novo; sair do jogo fecha', () => {
    const tela = criarTela(root, acoes);
    const m = modelo({ aba: 'legado', estado: estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }) });
    tela.renderizar(m);
    root.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    tela.renderizar({ ...m, estado: estado({ pontos: 1, bonus: { arvore: [1, 11], conquistas: 0 } }) });
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.no-arvore[data-no="11"]')!.classList.contains('comprado')).toBe(true);
    root.querySelector<HTMLButtonElement>('.arvore-topo .fechar')!.click();
    expect(document.activeElement).toBe(root.querySelector('.arvore-abrir'));
    root.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    tela.renderizar(modelo({ fase: 'sem_sessao', estado: null }));
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(true);
  });
  it('conquistas: N/total; grade de ícones; tocar mostra a frase e a data, tocar de novo fecha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({
      aba: 'legado',
      estado: estado({ conquistas: [{ id: 7, em: EM }], descobertas: [102], bonus: { arvore: [], conquistas: 1 } }),
    }));
    const lista = root.querySelector('.lista-legado')!;
    expect(lista.querySelector('.legado-cab')!.textContent).toContain(`1/${catalogo.conquistas.length} · +1% de produção`);
    const cel = (inicio: string) => root.querySelector<HTMLButtonElement>(`.conquista[aria-label^="${inicio}"]`);
    expect(cel('???, não ganha')!.textContent).toBe('?');
    expect(cel('???, não ganha')!.classList.contains('oculta')).toBe(true);
    expect(cel('Aura negativa')).toBeNull();
    const ganha = cel('Estágio não remunerado em escala, ganha')!;
    expect(ganha.classList.contains('ganha')).toBe(true);
    expect(ganha.querySelector<HTMLElement>('.icone-legado')!.style.backgroundImage).not.toBe('');
    ganha.click();
    let det = root.querySelector('.conquista-detalhe')!;
    expect(det.textContent).toContain('A princesa Isabel ficaria decepcionada.');
    expect(det.textContent).toContain('✓ Feito: Ter 100 "Estagiário"'); // o que precisou continua aparecendo
    expect(det.textContent).toContain('Ganhou em 12/10/2026');
    expect(cel('Estágio não remunerado em escala, ganha')!.getAttribute('aria-pressed')).toBe('true');
    cel('Cem abas abertas, não ganha')!.click();
    det = root.querySelector('.conquista-detalhe')!;
    expect(det.textContent).toContain('Ter 100 "Você, no notebook da faculdade"');
    expect(det.textContent).not.toContain('Ganhou em');
    cel('Cem abas abertas, não ganha')!.click();
    expect(root.querySelector('.conquista-detalhe')).toBeNull();
  });
  it('no PC (mouse): passar o mouse ou o foco mostra a caixinha da conquista; clicar não abre nada embaixo', () => {
    const mm = vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: q.includes('hover'), media: q } as MediaQueryList));
    try {
      const tela = criarTela(root, acoes);
      tela.renderizar(modelo({ aba: 'legado', estado: estado({ conquistas: [{ id: 7, em: EM }], bonus: { arvore: [], conquistas: 1 } }) }));
      const ganha = root.querySelector<HTMLButtonElement>('.conquista[aria-label^="Estágio não remunerado em escala"]')!;
      ganha.click();
      expect(root.querySelector('.conquista-detalhe')).toBeNull();
      ganha.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      const dica = root.querySelector('#idle-dica')!;
      expect(dica.hasAttribute('hidden')).toBe(false);
      expect(dica.textContent).toContain('Estágio não remunerado em escala');
      expect(dica.textContent).toContain('✓ Feito: Ter 100 "Estagiário"');
    } finally {
      mm.mockRestore();
    }
  });
  it('sem a arte: a conquista mostra só a moldura', () => {
    const sem = vi.spyOn(ativos, 'conquista').mockReturnValue(null);
    try {
      const tela = criarTela(root, acoes);
      tela.renderizar(modelo({ aba: 'legado' }));
      expect(root.querySelector('.conquista .icone-legado')!.classList.contains('sem-arte')).toBe(true);
    } finally {
      sem.mockRestore();
    }
  });
  it('depois de vender, antes do Abrir CNPJ: o Legado aparece e a raiz dá pra comprar pela árvore', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    expect(root.querySelector('.lista-legado')!.hasAttribute('hidden')).toBe(true); // nunca vendeu
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false, pontos: 5, pontos_vida: 5 }) }));
    expect(root.querySelector('.lista-legado')!.hasAttribute('hidden')).toBe(false);
    root.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    const b = root.querySelector<HTMLButtonElement>('.arvore-cartao button')!;
    expect(b.textContent).toBe('Comprar · 1 ★');
    b.click();
    expect(acoes.comprarNo).toHaveBeenCalledWith(1);
  });
  it('aviso de conquista no topo da tela (fora da cena): ícone, nome e frase; tocar abre a conquista no Legado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    expect(root.querySelector('.conquista-aviso')!.hasAttribute('hidden')).toBe(true); // sem aviso, sem caixa vazia
    tela.renderizar(modelo({ conquistaAviso: { id: 101, nome: '6-7', frase: 'Seis sete. Ninguém sabe por quê.' } }));
    expect(root.querySelector('.palco .conquista-aviso')).toBeNull();
    const aviso = root.querySelector<HTMLButtonElement>('.conquista-aviso')!;
    expect(aviso.hasAttribute('hidden')).toBe(false);
    expect(aviso.textContent).toContain('Conquista desbloqueada');
    expect(aviso.textContent).toContain('6-7');
    expect(aviso.textContent).toContain('Seis sete. Ninguém sabe por quê.');
    expect(aviso.querySelector<HTMLElement>('.icone-legado')!.style.backgroundImage).not.toBe('');
    aviso.click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('legado');
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ conquistas: [{ id: 101, em: EM }], descobertas: [101] }) }));
    expect(root.querySelector('.conquista[aria-label^="6-7"]')!.classList.contains('destaque')).toBe(true);
    expect(root.querySelector('.conquista-detalhe')!.textContent).toContain('6-7'); // celular: já abre o detalhe
    tela.renderizar(modelo());
    expect(root.querySelector('.conquista-aviso')!.hasAttribute('hidden')).toBe(true);
  });
  it('aviso de várias de uma vez: sem ícone, leva pro Legado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ conquistaAviso: { id: null, nome: '5 conquistas novas!', frase: 'Olha no Legado.' } }));
    const aviso = root.querySelector<HTMLButtonElement>('.conquista-aviso')!;
    expect(aviso.textContent).toContain('5 conquistas novas!');
    expect(aviso.querySelector('.icone-legado')!.classList.contains('sem-arte')).toBe(true);
    aviso.click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('legado');
  });
  it('placar: ★ N (ganhos na vida) ao lado do F$/s de quem tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [linha({ pontos: 12 }), linha({ userId: 'c', name: 'Teteu' })] }));
    const itens = root.querySelectorAll('.lista-placar li');
    expect(itens[0].querySelector('.pontos')!.textContent).toBe('★ 12');
    expect(itens[1].querySelector('.pontos')).toBeNull();
    expect(itens[0].querySelector('.v')!.textContent).toContain('/s');
  });
  it('quatro abas: Loja, Gente, Placar, Legado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    expect([...root.querySelectorAll('.abas .aba')].map((b) => b.textContent)).toEqual(['Loja', 'Gente', 'Placar', 'Legado']);
    porTexto('Gente').click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('gente');
    porTexto('Legado').click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('legado');
  });
  it('Loja: Geradores | Melhorias troca a lista; Melhorias diz quantas estão à venda', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const [verG, verM] = [...root.querySelectorAll<HTMLButtonElement>('.seg-loja button')];
    expect(verG.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.lista-melhorias')!.hasAttribute('hidden')).toBe(true);
    expect(verM.textContent).toMatch(/^Melhorias \(\d+\)$/);
    verM.click();
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.lista-melhorias')!.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.seg-loja button:last-child')!.getAttribute('aria-pressed')).toBe('true');
    // fora da Loja, o seletor some
    tela.renderizar(modelo({ aba: 'placar', placar: [] }));
    expect(root.querySelector('.seg-loja')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.lista-melhorias')!.hasAttribute('hidden')).toBe(true);
  });
  it('caixinha: o "some em" usa o tamanho da árvore (4 com Print de tudo: sai com a 4ª mais nova)', () => {
    vi.useFakeTimers();
    try {
      const uid = '00000000-0000-0000-0000-00000000000a';
      const agora = instante(uid, 50) + 5 * 60 * 1000;
      vi.setSystemTime(agora);
      const tela = criarTela(root, acoes);
      tela.renderizar(modelo({ caixaAberta: true, pendentes: [50], estado: estado({ user_id: uid, bonus: { arvore: [1, 31, 32], conquistas: 0 } }) }));
      const com4 = root.querySelector('.modal-caixa .prazo')!.textContent;
      expect(com4).toBe(prazo(sai(uid, 50, 4) - agora));
      expect(com4).not.toBe(prazo(sai(uid, 50, 3) - agora));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('empresa, resumo e bancada', () => {
  it('porta Bolsa: apagada sem Grupo de trader; com trader abre a Bolsa', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const g = root.querySelector<HTMLButtonElement>('.gaveta-bolsa')!;
    expect(g.classList.contains('trancada')).toBe(true);
    expect(g.getAttribute('aria-label')).toBe('Bolsa: Compra 1 Grupo de trader pra abrir');
    g.click();
    expect(acoes.bolsa).toHaveBeenCalledWith('abrir');
    const gens = [...Array(18).fill(1), 1, ...Array(11).fill(0)];
    tela.renderizar(modelo({ estado: estado({ generators: gens }) }));
    expect(root.querySelector('.gaveta-bolsa')!.classList.contains('trancada')).toBe(false);
  });
  it('Bolsa aberta: em tela cheia com a Bolsa no corpo; Voltar e Esc fecham', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ bolsaAberta: true, bolsa: null }));
    const cheia = root.querySelector<HTMLElement>('.minigame-tela')!;
    expect(cheia.hasAttribute('hidden')).toBe(false);
    expect(cheia.querySelector('.minigame-corpo .bolsa')).not.toBeNull();
    expect(cheia.querySelector('h2')!.textContent).toBe('Bolsa');
    [...cheia.querySelectorAll('button')].find((x) => x.textContent === '← Voltar')!.click();
    expect(acoes.bolsa).toHaveBeenCalledWith('fechar');
    cheia.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(acoes.bolsa).toHaveBeenCalledTimes(2);
  });
  it('Bolsa ou Horta aberta: redesenhar a página não tira o minigame do lugar (sair e voltar zera a rolagem)', () => {
    const tela = criarTela(root, acoes);
    for (const aberta of [{ bolsaAberta: true }, { hortaAberta: true }]) {
      tela.renderizar(modelo(aberta));
      const corpo = root.querySelector('.minigame-corpo')!;
      const obs = new MutationObserver(() => {});
      obs.observe(corpo, { childList: true });
      tela.renderizar(modelo(aberta));
      expect(obs.takeRecords()).toHaveLength(0);
      obs.disconnect();
    }
  });
  it('topo: a engrenagem abre as Configurações; a bolinha aparece com novidade não lida', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ novidadeNova: true }));
    const eng = root.querySelector<HTMLButtonElement>('.top .topo-config')!;
    expect(eng.getAttribute('aria-label')).toBe('Configurações (tem novidade)');
    expect(eng.querySelector('.ponto')!.hasAttribute('hidden')).toBe(false);
    eng.click();
    expect(acoes.config).toHaveBeenCalledWith('abrir');
    tela.renderizar(modelo({ novidadeNova: false }));
    expect(eng.getAttribute('aria-label')).toBe('Configurações');
    expect(eng.querySelector('.ponto')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.top .topo-visual')).toBeNull(); // o Mudar visual mudou pra dentro
  });
  it('Configurações: volume da música (barra), Efeitos sonoros e Avisos (chaves), Mudar visual e Patch notes', () => {
    const tela = criarTela(root, acoes);
    expect(root.querySelector('.modal-config')!.hasAttribute('hidden')).toBe(true);
    tela.renderizar(modelo({ config: 'menu', volumeMusica: 0.7, chaves: { efeitos: false, avisos: true }, novidadeNova: true }));
    const modal = root.querySelector<HTMLElement>('.modal-config')!;
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect([...modal.querySelectorAll('.config-item .rotulo')].map((x) => x.textContent)).toEqual(['Música', 'Efeitos sonoros', 'Avisos', 'Mudar visual', 'Patch notes']);
    const barra = modal.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(barra.getAttribute('aria-label')).toBe('Volume da música');
    expect(barra.value).toBe('70');
    expect(modal.querySelector('.volume-valor')!.textContent).toBe('70%');
    barra.value = '40';
    barra.dispatchEvent(new Event('input', { bubbles: true }));
    expect(acoes.volumeMusica).toHaveBeenLastCalledWith(0.4);
    expect(modal.querySelector('.volume-valor')!.textContent).toBe('40%');
    expect(barra.getAttribute('aria-valuetext')).toBe('40%');
    barra.value = '0';
    barra.dispatchEvent(new Event('input', { bubbles: true }));
    expect(modal.querySelector('.volume-valor')!.textContent).toBe('Desligada');
    const chaves = [...modal.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
    expect(chaves.map((c) => [c.getAttribute('aria-label'), c.getAttribute('aria-checked'), c.textContent])).toEqual([
      ['Efeitos sonoros', 'false', 'Desligados'], ['Avisos', 'true', 'Ligados'],
    ]);
    chaves[0].click();
    chaves[1].click();
    expect(acoes.chave.mock.calls).toEqual([['efeitos', true], ['avisos', false]]);
    // re-render com a barra na mão (focada) não volta o valor
    barra.value = '55';
    barra.focus();
    tela.renderizar(modelo({ config: 'menu', volumeMusica: 0.7, chaves: { efeitos: false, avisos: true } }));
    expect(modal.querySelector<HTMLInputElement>('input[type="range"]')!.value).toBe('55');
    const item = (t: string) => [...modal.querySelectorAll<HTMLButtonElement>('button.config-item')].find((b) => b.querySelector('.rotulo')!.textContent === t)!;
    item('Patch notes').click();
    expect(acoes.config).toHaveBeenCalledWith('notas');
    item('Mudar visual').click();
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
  });
  it('som da interface: clique em aba e em chave; comprar não clica (a compra tem o som dela); folha abrindo e fechando', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    root.querySelector<HTMLButtonElement>('.aba')!.click();
    expect(acoes.efeito).toHaveBeenCalledWith('clique');
    acoes.efeito.mockClear();
    root.querySelector<HTMLButtonElement>('.gerador button[data-qtd="1"]')!.click();
    expect(acoes.efeito).not.toHaveBeenCalled();
    tela.renderizar(modelo({ caixaAberta: true }));
    expect(acoes.efeito).toHaveBeenLastCalledWith('abrir');
    tela.renderizar(modelo({ caixaAberta: false }));
    expect(acoes.efeito).toHaveBeenLastCalledWith('fechar');
  });
  it('Patch notes: as versões da mais nova pra mais antiga, com data e linhas; Voltar volta pro menu', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ config: 'notas' }));
    const modal = root.querySelector<HTMLElement>('.modal-config')!;
    expect([...modal.querySelectorAll('.nota h3')].map((x) => x.textContent)).toEqual(NOVIDADES.map((n) => n.titulo));
    expect(modal.querySelector('.nota')!.textContent).toContain(NOVIDADES[0].itens[0]);
    [...modal.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Voltar')!.click();
    expect(acoes.config).toHaveBeenCalledWith('menu');
  });
  it('resumo: era, contratados e o bônus das conquistas (some o que for zero)', () => {
    const tela = criarTela(root, acoes);
    const ate = '2026-10-19T12:00:00.000Z';
    tela.renderizar(modelo({ estado: estado({
      era: 3,
      equipe: [{ user_id: 'b', cargo: 'CEO de nada', avatar: null, ate }, { user_id: 'c', cargo: 'Estagiário', avatar: null, ate }],
      bonus: { arvore: [], conquistas: 12 },
    }) }));
    expect([...root.querySelectorAll('.valor .info span')].map((x) => x.textContent))
      .toEqual(['Era 3 · Escritório', '2 contratados', '+12% das conquistas']);
    tela.renderizar(modelo());
    expect([...root.querySelectorAll('.valor .info span')].map((x) => x.textContent)).toEqual(['Era 1 · Quarto']);
  });
  it('a Caixinha da bancada: o selo some sem nada guardado e o aviso aparece no lugar da lista', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ pendentes: [3] }));
    expect(root.querySelector('.bancada-caixa .selo')!.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.bancada-caixa-cab')!.textContent).toContain('Hoje ainda dá pra pegar 10');
    tela.renderizar(modelo({ pendentes: [] }));
    expect(root.querySelector('.bancada-caixa .selo')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.bancada-caixa-itens')!.textContent).toContain('Nada guardado agora. Volta mais tarde.');
  });
  it('a Caixinha da bancada lista as guardadas com Pegar, com as mesmas regras da folha', () => {
    const uid = '00000000-0000-0000-0000-00000000000a';
    const janela = (k: 0 | 1 | 2) => { let w = 50; while (tipo(uid, w) !== k) w++; return w; };
    const meia = janela(2);
    const outra = janela(0);
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ pendentes: [meia, outra], estado: estado({ user_id: uid, half_price: true }) }));
    const [m1, o1] = [...root.querySelectorAll('.bancada .escolha')];
    expect(m1.querySelector('button')!.disabled).toBe(true);
    expect(m1.textContent).toContain('Usa a que você já tem primeiro');
    o1.querySelector('button')!.click();
    expect(acoes.pegar).toHaveBeenCalledWith(outra);
    tela.renderizar(modelo({ pendentes: [outra], estado: estado({ user_id: uid, opp_left: 0 }) }));
    expect(root.querySelector('.bancada-caixa-cab')!.textContent).toContain('Já pegou todas de hoje');
    expect(root.querySelector<HTMLButtonElement>('.bancada .escolha button')!.disabled).toBe(true);
    tela.renderizar(modelo({ pendentes: [outra], estado: estado({ user_id: uid }), ocupado: true }));
    expect(root.querySelector<HTMLButtonElement>('.bancada .escolha button')!.disabled).toBe(true);
  });
  it('antes do Abrir CNPJ: sem bancada; sem Legado o painel some', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    expect(root.querySelector('.bancada')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.app')!.classList.contains('sem-painel')).toBe(true);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false, pontos: 5, pontos_vida: 5 }) }));
    expect(root.querySelector('.app')!.classList.contains('sem-painel')).toBe(false);
    tela.renderizar(modelo());
    expect(root.querySelector('.app')!.classList.contains('sem-painel')).toBe(false);
  });
});
