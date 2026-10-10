// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { IdleBoardRow, IdleState } from '../shared/types';
import type { Desenhar } from './navegador';
import { instante, VALIDADE_S } from './oportunidades';
import { PADRAO } from './personagem';
import { criarTela, empresas, porcento, prazo, restam, type Acoes, type Modelo } from './tela';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  ...x,
});
const modelo = (x: Partial<Modelo> = {}): Modelo => ({
  fase: 'jogando', estado: estado(), aba: 'geradores', placar: null, aviso: null, ocupado: false, pendentes: [], aoVivo: null, caixaAberta: false, editor: null, placarFalhou: false, ...x,
});

let acoes: { [K in keyof Acoes]: Mock<Acoes[K]> };
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  acoes = {
    abrirCnpj: vi.fn<Acoes['abrirCnpj']>(), comprar: vi.fn<Acoes['comprar']>(), escolher: vi.fn<Acoes['escolher']>(), pegar: vi.fn<Acoes['pegar']>(),
    trocarAba: vi.fn<Acoes['trocarAba']>(), caixa: vi.fn<Acoes['caixa']>(), tentarDeNovo: vi.fn<Acoes['tentarDeNovo']>(),
    contratar: vi.fn<Acoes['contratar']>(), editor: vi.fn<Acoes['editor']>(), mudarVisual: vi.fn<Acoes['mudarVisual']>(),
  };
});
const porTexto = (texto: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === texto)!;

describe('tela da Fellas Inc.', () => {
  it('antes: só o Abrir CNPJ', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    porTexto('Abrir CNPJ').click();
    expect(acoes.abrirCnpj).toHaveBeenCalled();
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(true);
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
  it('aviso aparece; caixinha mostra quantas tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aviso: 'Valuation não cobre essa compra', pendentes: [3, 2] }));
    expect(root.querySelector('.notice')!.textContent).toContain('Valuation não cobre essa compra');
    expect(root.querySelector('.caixinha')!.textContent).toBe('Oportunidades (2)');
  });
  it('caixinha: uma linha por oportunidade com o boneco, o prazo e Pegar; X fecha; sem pega no dia, botões apagados', () => {
    vi.useFakeTimers();
    const uid = '00000000-0000-0000-0000-00000000000a';
    vi.setSystemTime(instante(uid, 50) + 60 * 60 * 1000); // 1h depois de a janela 50 aparecer
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ caixaAberta: true, pendentes: [50], estado: estado({ user_id: uid }) }));
    const linha = root.querySelector('.modal-caixa .escolha')!;
    expect((linha.querySelector('.boneco') as HTMLElement).style.backgroundImage).toContain('url(');
    expect(linha.querySelector('.prazo')!.textContent).toBe('some em 3h00');
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
    expect(prazo(VALIDADE_S * 1000)).toBe('some em 4h00');
    expect(prazo((3 * 60 + 12) * 60000)).toBe('some em 3h12');
    expect(prazo(40 * 60000)).toBe('some em 40 min');
    expect(prazo(30000)).toBe('some em menos de 1 min');
  });
  it('melhorias: Compradas mostra as que você já tem, da mais recente pra mais antiga, sem botão de compra', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'melhorias', estado: estado({ upgrades: [1001, 1002] }) }));
    porTexto('Compradas (2)').click();
    const itens = [...root.querySelectorAll('.lista-melhorias .melhoria')];
    expect(itens.map((x) => x.querySelector('strong')!.textContent)).toEqual(['Wi-Fi do vizinho', 'Café coado na hora']);
    expect(itens.every((x) => !x.querySelector('.btn'))).toBe(true);
    expect(porTexto('Compradas (2)').getAttribute('aria-pressed')).toBe('true');
    porTexto(root.querySelector('.seg button')!.textContent!).click();
    expect(root.querySelector('.lista-melhorias')!.textContent).not.toContain('Wi-Fi do vizinho');
  });
  it('placar mostra o R$/s de cada um, não o valuation', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [{ userId: 'b', name: 'Bia', valuation: 9e9, rate: 1234.5, era: 3, strategies: [0, -1, -1, -1], avatar: null, hiredCount: 0, byMe: false, mostHired: false }] }));
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
    tela.renderizar(modelo({ estado: estado({ era: 2, generators: [1, 1, 1, 1, 1, 1, 1, ...Array(23).fill(0)] }), caixaAberta: true, editor: { ...PADRAO } }));
    for (const sel of ['.modal-estrategia', '.modal-caixa', '.modal-visual']) {
      const modal = root.querySelector(sel)!;
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(root.querySelector(`#${modal.getAttribute('aria-labelledby')}`)!.tagName).toBe('H2');
    }
  });
});

const linha = (x: Partial<IdleBoardRow> = {}): IdleBoardRow => ({
  userId: 'b', name: 'Bia', valuation: 1000, rate: 2, era: 2, strategies: [0, -1, -1, -1],
  avatar: null, hiredCount: 0, byMe: false, mostHired: false, ...x,
});
const ATE = '2026-10-19T00:00:00.000Z'; // 6,5 dias depois do server_now das fixtures

describe('contratar', () => {
  it('cartas de quem abriu a empresa (menos você); botão libera no preço; tocar contrata', () => {
    const desenhar = vi.fn<Desenhar>();
    const tela = criarTela(root, acoes, desenhar);
    tela.renderizar(modelo({ aba: 'contratar', estado: estado({ hire_price: 918 }), placar: [linha({ userId: 'u', name: 'Você' }), linha()] }));
    const cartas = root.querySelectorAll('.lista-contratar .carta');
    expect(cartas).toHaveLength(1);
    expect(cartas[0].textContent).toContain('Bia');
    expect(cartas[0].textContent).toContain('Garagem · ninguém contratou ainda');
    const b = cartas[0].querySelector('button')!;
    expect(b.textContent).toBe('Contratar · R$ 918');
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
      aba: 'contratar',
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
    tela.renderizar(modelo({ aba: 'contratar', placar: [] }));
    const topo = root.querySelector('.contratos-topo')!;
    expect(topo.textContent).toContain('Contratos: +2% de produção');
    expect(topo.textContent).toContain('Ninguém te contratou: você ganha o piso de freela.');
    expect(root.querySelector('.lista-contratar')!.textContent).toContain('Ninguém mais abriu a empresa ainda. Chama a galera.');
    [...topo.querySelectorAll('button')].find((x) => x.textContent === 'Mudar visual')!.click();
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
    tela.renderizar(modelo({
      aba: 'contratar', placar: [linha()],
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
    tela.renderizar(modelo({ aba: 'contratar', placar: null }));
    expect(root.querySelector('.lista-contratar')!.textContent).toContain('Carregando…');
    tela.renderizar(modelo({ aba: 'contratar', placar: null, placarFalhou: true }));
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
