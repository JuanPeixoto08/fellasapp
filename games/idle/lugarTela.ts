// A tela de um lugar do Mapa do rolê (DOM): o cabeçalho (moeda, nível, fãs e o Subir nível), o miolo da mecânica do
// lugar (mecanicas.ts; sem ela, "Em breve") e a faixa com o pódio de sempre, a semana, o desafio, os marcos e o
// caderninho. Quem decide é o banco; aqui só mostra e chama.
import { button, el } from '../shared/hud/hud';
import type { LugarEstado, ProducaoLugar } from '../shared/types';
import { dicaDesafio, dicaMarco, dicaNivel, num, plural, TERMOS_LUGAR } from './dica';
import { criarFoco } from './foco';
import { formatarValor } from './formatar';
import { formatarNumero, LUGARES, MARCOS, type Marco } from './mapa';
import { MECANICAS, type Dicas, type TelaMecanica } from './mecanicas';
import { nomeLugar, type Boneco } from './mapaTela';
import { aplicarTema } from './temasLugar';

/** Um número da moeda do lugar, resumido como o F$ ("1,2 mil"), sem o "F$". */
const quantia = (n: number) => formatarValor(n).replace('F$ ', '');
const ROTULO_MARCO = (m: Marco) => (m.tipo === 'nivel' ? `Nív. ${m.valor}` : m.tipo === 'lendario' ? 'Lenda' : m.tipo === 'fas' ? 'Fãs' : 'Volume');
/** `investidor` = quanto o Investidor apressado paga agora (ganhoInvestidor); null = sem o número. */
const PREMIO = (d: NonNullable<LugarEstado['desafio']>, investidor: number | null) => (d.premio === 'horas' ? `${num(d.premio_valor)} h de produção em F$`
  : d.premio === 'legado' ? `${num(d.premio_valor)} ${d.premio_valor === 1 ? 'ponto' : 'pontos'} do Legado`
    : `Investidor na hora${investidor === null ? '' : ` (${formatarValor(investidor)})`}`);

export function criarLugarTela(
  a: { voltar(): void; nivel(id: number): void; acao(fn: string, args: Record<string, unknown>): void; recarregar?(): void; usuario?(): string | null },
  dicas: Dicas,
  boneco: Boneco = () => el('span'),
) {
  const raiz = el('div', 'lugar-tela');
  /** A tela da mecânica de cada lugar, criada uma vez (o miolo guarda o que a pessoa está montando). */
  const telas = new Map<number, TelaMecanica>();
  /** O miolo fica o mesmo (e no lugar) entre um desenho e outro: tirar e pôr a mecânica de volta zeraria a rolagem dela e
   *  tiraria o foco do teclado de dentro dela. Só o cabeçalho e a faixa são trocados. */
  const corpo = el('div', 'lugar-corpo');
  /** O foco do teclado no cabeçalho e na faixa volta pro equivalente depois de redesenhar (data-foco). */
  const foco = criarFoco(raiz);

  const bloco = (cls: string, titulo: string) => {
    const s = el('section', `lugar-bloco ${cls}`);
    s.append(el('h3', 'rot2', titulo));
    return s;
  };
  const quem = (userId: string, avatar: ProducaoLugar['avatar'], nomes: Map<string, string>) => {
    const q = el('span', 'quem');
    q.append(boneco(avatar), el('span', 'nome', nomes.get(userId) ?? 'Alguém'));
    return q;
  };

  /** `investidor` = quanto o prêmio "Investidor na hora" paga agora (ganhoInvestidor de dourados.ts; null = sem o número). */
  function renderizar(l: LugarEstado | null, ocupado: boolean, agoraMs: number, nomes: Map<string, string>, investidor: number | null = null): void {
    aplicarTema(raiz, l?.id ?? null); // as cores do ícone do lugar (sem tema: as de sempre)
    const chave = foco.guardar();
    if (!l) {
      raiz.replaceChildren(el('p', 'vazio lugar-carregando', 'Carregando o lugar…'));
      return;
    }
    if (!l.aberto) {
      const p = el('div', 'lugar-fechado');
      const voltar = button('Voltar pro mapa', 'btn', () => a.voltar());
      voltar.dataset.foco = 'voltar';
      p.append(el('p', 'vazio', 'Esse lugar ainda tá fechado. Abre ele no mapa.'), voltar);
      raiz.replaceChildren(p);
      foco.devolver(chave);
      return;
    }
    const cat = LUGARES.find((x) => x.id === l.id);
    const numero = (n: number) => (cat ? formatarNumero({ ...cat, numero: l.numero }, n) : String(n));
    const mec = MECANICAS[l.id];
    const nivel = l.nivel ?? 1;
    const termos = TERMOS_LUGAR[l.id] ?? { fas: 'fãs', volume: 'feitos' };

    // ----- cabeçalho: a frase, moeda, nível, fãs e o Subir nível -----
    const cab = el('header', 'lugar-cab');
    const ident = el('div', 'lugar-ident');
    ident.append(el('h3', 'so-leitor', nomeLugar(l)));
    if (l.frase) ident.append(el('p', 'lugar-frase', l.frase));
    const numeros = el('div', 'lugar-numeros');
    for (const [rot, valor, cls] of [
      [plural(l.moeda_nome), quantia(l.moeda ?? 0), 'moeda'],
      ['nível', `${nivel}`, 'nivel'],
      [termos.fas, quantia(l.fas ?? 0), 'fas'],
    ] as const) {
      const n = el('span', `lugar-num ${cls}`);
      n.append(el('b', undefined, valor), el('span', undefined, rot));
      numeros.append(n);
    }
    const subir = button('', 'btn main subir-nivel', () => a.nivel(l.id));
    subir.dataset.foco = 'subir';
    if (l.preco_nivel === null) {
      subir.append(el('span', undefined, 'Nível máximo'));
      subir.disabled = true;
    } else {
      subir.append(el('span', undefined, 'Subir nível'), el('span', 'preco-nivel', `${quantia(Math.ceil(l.preco_nivel))} ${plural(l.moeda_nome)}`));
      subir.disabled = ocupado || (l.moeda ?? 0) < l.preco_nivel;
    }
    dicas.ligar(subir, `nivel${l.id}`, 'Subir nível', () => dicaNivel(l, mec?.libera(nivel + 1) ?? []));
    cab.append(ident, numeros, subir);

    // ----- miolo: a mecânica do lugar -----
    if (mec) {
      let t = telas.get(l.id);
      if (!t) {
        t = mec.criar({ acao: (fn, args) => a.acao(fn, args), recarregar: () => a.recarregar?.(), usuario: () => a.usuario?.() ?? null }, dicas);
        telas.set(l.id, t);
      }
      t.renderizar(l, ocupado, agoraMs);
      if (corpo.childNodes.length !== 1 || corpo.firstChild !== t.elemento) corpo.replaceChildren(t.elemento);
    } else corpo.replaceChildren(el('p', 'vazio', 'Em breve: o que dá pra fazer aqui chega num próximo lote.'));

    // ----- a faixa: pódio, semana, desafio, marcos e caderninho -----
    const faixa = el('aside', 'lugar-faixa');
    const podio = bloco('podio', 'Pódio de sempre');
    const lista = el('ol', 'podio-lista');
    for (let i = 0; i < 3; i++) {
      const p = l.podio[i];
      const li = el('li', `podio-pos${p ? '' : ' vaga'}`);
      li.append(el('span', 'pos', `${i + 1}º`));
      const foto = p && mec ? mec.foto(p.partes) : el('span');
      foto.classList.add('podio-foto');
      if (!p || !mec) foto.classList.add('vazia');
      foto.setAttribute('aria-hidden', 'true');
      li.append(foto);
      const meio = el('span', 'meio');
      if (p) {
        const topo = el('span', 'podio-topo');
        topo.append(el('strong', 'podio-nome', p.nome), el('b', 'podio-numero', numero(p.numero)));
        meio.append(topo, quem(p.user_id, p.avatar, nomes));
      } else meio.append(el('span', 'sub', i === 0 ? 'Ninguém lançou nada aqui ainda. Bora ser o primeiro?' : 'Vaga'));
      li.append(meio);
      lista.append(li);
    }
    podio.append(lista);

    const semana = bloco('semana', 'Melhores da semana');
    if (l.semana.length) {
      const ol = el('ol', 'semana-lista');
      l.semana.slice(0, 3).forEach((s, i) => {
        const li = el('li');
        li.append(el('span', 'pos', `${i + 1}º`), quem(s.user_id, s.avatar, nomes), el('b', 'semana-numero', numero(s.numero)));
        ol.append(li);
      });
      semana.append(ol);
    } else semana.append(el('p', 'sub', 'Ninguém lançou nada essa semana. Abre os trabalhos.'));
    if (l.dono) {
      const d = el('p', 'dono-pedaco');
      d.append(boneco(l.dono.avatar), el('span', undefined, `Dono do pedaço: ${nomes.get(l.dono.user_id) ?? 'Alguém'}`));
      semana.append(d);
    }

    const desafio = bloco('desafio', 'Desafio da semana');
    if (l.desafio) {
      const d = l.desafio;
      const corpoD = el('div', `desafio-corpo${d.feito ? ' feito' : ''}`);
      corpoD.tabIndex = 0;
      corpoD.dataset.foco = 'desafio';
      corpoD.append(el('p', 'desafio-texto', d.texto));
      const pe = el('p', 'desafio-premio');
      pe.append(el('span', undefined, `Prêmio: ${PREMIO(d, investidor)}`));
      if (d.feito) pe.append(el('b', 'desafio-feito', '✓ Feito'));
      corpoD.append(pe);
      dicas.ligar(corpoD, `desafio${l.id}`, 'Desafio da semana', () => dicaDesafio(d, investidor));
      desafio.append(corpoD);
    } else desafio.append(el('p', 'sub', 'Sem desafio essa semana.'));

    const marcos = bloco('marcos-bloco', 'Marcos');
    const grade = el('div', 'marcos');
    for (const m of MARCOS.filter((x) => x.lugar === l.id)) {
      const ganho = l.marcos.includes(m.id);
      const q = el('span', `marco${ganho ? ' ganho' : ''}`);
      q.tabIndex = 0;
      q.dataset.foco = `marco${m.id}`;
      q.append(el('span', 'marco-rot', ROTULO_MARCO(m)), el('b', undefined, `+${Math.round(m.bonus * 100)}%`));
      q.setAttribute('aria-label', dicaMarco(m, l));
      dicas.ligar(q, `marco${m.id}`, ganho ? 'Marco ganho' : 'Marco', () => dicaMarco(m, l));
      grade.append(q);
    }
    marcos.append(grade);

    const cad = bloco('caderninho', 'Caderninho');
    cad.append(mec ? mec.caderninho(l.caderninho) : el('p', 'sub', 'O que você descobrir aqui fica anotado.'));

    faixa.append(podio, semana, desafio, marcos, cad);
    // o miolo não sai do lugar (mover um elemento tira o foco de dentro dele): troca só o cabeçalho e a faixa
    const [cabAntes, corpoAntes, faixaAntes] = [...raiz.children];
    if (raiz.children.length === 3 && corpoAntes === corpo) {
      cabAntes.replaceWith(cab);
      faixaAntes.replaceWith(faixa);
    } else raiz.replaceChildren(cab, corpo, faixa);
    foco.devolver(chave);
  }

  return { elemento: raiz, renderizar };
}
