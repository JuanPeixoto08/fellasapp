// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { LugarEstado } from '../shared/types';
import { criarLugarTela } from './lugarTela';
import { MECANICAS } from './mecanicas';
import { TEMAS_LUGAR } from './temasLugar';

const lugar = (extra: Partial<LugarEstado> = {}): LugarEstado => ({
  id: 3, moeda_nome: 'cupom', numero: 'pct', lancado: true, nome: null, frase: null, icone: null,
  aberto: true, nivel: 3, moeda: 50, fas: 10, volume: 0, lendario: false, marcos: [], preco_nivel: 240,
  desafio: { id: 1, texto: 'Faz um negócio', premio: 'horas', premio_valor: 2, feito: false },
  podio: [{ id: 1, user_id: 'u1', nome: 'Camisa boa', partes: [1], numero: 230, criado_em: '2026-10-12T00:00:00Z', avatar: null }],
  semana: [], dono: null, caderninho: [], mecanica: null, server_now: '2026-10-12T12:00:00Z', ...extra,
});
const dicas = { ligar: vi.fn() };

describe('moldura do lugar', () => {
  it('cabeçalho, pódio com número formatado e nome de quem fez', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar(), false, 0, new Map([['u1', 'Juan']]));
    expect(t.elemento.textContent).toContain('Lugar 3');
    expect(t.elemento.textContent).toContain('Camisa boa');
    expect(t.elemento.textContent).toContain('230%');
    expect(t.elemento.textContent).toContain('Juan');
  });
  it('subir nível: desabilitado sem moeda, chama com moeda', () => {
    const a = { voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() };
    const t = criarLugarTela(a, dicas);
    t.renderizar(lugar(), false, 0, new Map());
    const b = t.elemento.querySelector<HTMLButtonElement>('.subir-nivel')!;
    expect(b.disabled).toBe(true);
    t.renderizar(lugar({ moeda: 1000 }), false, 0, new Map());
    t.elemento.querySelector<HTMLButtonElement>('.subir-nivel')!.click();
    expect(a.nivel).toHaveBeenCalledWith(3);
  });
  it('sem mecânica registrada o corpo diz "Em breve"; com mecânica, desenha a dela', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar(), false, 0, new Map());
    expect(t.elemento.querySelector('.lugar-corpo')!.textContent).toContain('Em breve');
    MECANICAS[3] = {
      criar: () => { const e = document.createElement('div'); e.textContent = 'mecânica de teste'; return { elemento: e, renderizar: () => undefined }; },
      foto: () => document.createElement('canvas'), caderninho: () => document.createElement('div'), libera: () => [],
    };
    const t2 = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t2.renderizar(lugar(), false, 0, new Map());
    expect(t2.elemento.querySelector('.lugar-corpo')!.textContent).toContain('mecânica de teste');
    delete MECANICAS[3];
  });
  it('marcos: 8 quadradinhos, os ganhos acesos', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar({ marcos: [31, 32] }), false, 0, new Map());
    const ms = t.elemento.querySelectorAll('.marco');
    expect(ms).toHaveLength(8);
    expect(t.elemento.querySelectorAll('.marco.ganho')).toHaveLength(2);
  });
  it('a mecânica é criada uma vez por lugar e recebe o estado a cada desenho', () => {
    const renderizar = vi.fn();
    const criar = vi.fn(() => ({ elemento: document.createElement('div'), renderizar }));
    MECANICAS[3] = { criar, foto: () => document.createElement('canvas'), caderninho: () => document.createElement('div'), libera: () => [] };
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar(), false, 0, new Map());
    t.renderizar(lugar({ moeda: 99 }), true, 5, new Map());
    expect(criar).toHaveBeenCalledTimes(1);
    expect(renderizar).toHaveBeenLastCalledWith(expect.objectContaining({ moeda: 99 }), true, 5);
    delete MECANICAS[3];
  });
  it('pódio vazio, semana com dono do pedaço e o desafio feito', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar({
      podio: [], semana: [{ user_id: 'u2', numero: 180, avatar: null }], dono: { user_id: 'u1', numero: 200, avatar: null },
      desafio: { id: 1, texto: 'Faz um negócio', premio: 'legado', premio_valor: 2, feito: true },
    }), false, 0, new Map([['u1', 'Juan'], ['u2', 'Bia']]));
    expect(t.elemento.querySelectorAll('.podio-pos')).toHaveLength(3);
    const faixa = t.elemento.querySelector('.lugar-faixa')!.textContent;
    expect(faixa).toContain('Bia');
    expect(faixa).toContain('180%');
    expect(faixa).toContain('Dono do pedaço: Juan');
    expect(faixa).toContain('Faz um negócio');
    expect(faixa).toContain('2 pontos do Legado');
    expect(faixa).toContain('✓ Feito');
  });
  it('o lugar 3 desenha com o tema dele; lugar sem tema fica com as cores de sempre', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar(), false, 0, new Map());
    expect(t.elemento.dataset.tema).toBe('3');
    expect(t.elemento.style.getPropertyValue('--lugar-acento')).toBe(TEMAS_LUGAR[3]!.acento);
    t.renderizar(lugar({ id: 1 }), false, 0, new Map());
    expect(t.elemento.dataset.tema).toBeUndefined();
    expect(t.elemento.style.getPropertyValue('--lugar-acento')).toBe('');
  });
  it('carregando: sem estado ainda, avisa', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(null, false, 0, new Map());
    expect(t.elemento.textContent).toContain('Carregando');
  });
});
