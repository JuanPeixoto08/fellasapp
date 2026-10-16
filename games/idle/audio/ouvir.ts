// Página de audição (/games/idle/audio/ouvir.html): ouvir cada era e cada efeito e pedir ajustes. Não precisa de login
// e não mexe na empresa. "Medir" renderiza tudo sem tocar (OfflineAudioContext) e mostra o pico de cada um.
import './ouvir.css';
import { IDS_EFEITOS, RECEITAS, type IdEfeito, type OpcoesEfeito } from './efeitos';
import { criarAudio } from './index';
import { INSTRUMENTOS } from './instrumentos';
import { montarSaida } from './motor';
import { criarSala, molhadoDaEra } from './sala';
import { bpm, notasDoGiro, segundosDoGiro } from './musica';

const ERAS = ['Antes do CNPJ', 'Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede', 'Em órbita', 'Lua'];
const EFEITOS: [string, IdEfeito, OpcoesEfeito?][] = [
  ['Comprar 1', 'compra'], ['Comprar 10', 'compraMuitas', { quantas: 10 }], ['Comprar Máx (1000)', 'compraMuitas', { quantas: 1000 }],
  ['Nó da árvore', 'no'], ['Comprar ação', 'acaoCompra'], ['Vender com lucro', 'acaoVende', { lucro: true }],
  ['Vender com prejuízo', 'acaoVende', { lucro: false }], ['Conquista', 'conquista'], ['Era nova', 'era'], ['Vender a startup', 'venda'],
  ['Te contrataram', 'contratado'], ['Ações viraram pó', 'po'], ['Oportunidade nova', 'oportunidade'], ['Pegar oportunidade', 'pegar'],
  ['Abrir CNPJ', 'cnpj'], ['Erro', 'erro'], ['Clique', 'clique'], ['Abrir folha', 'abrir'], ['Fechar folha', 'fechar'],
  ['Dourado apareceu', 'dourado'], ['Pegou o dourado', 'douradoPego'],
  ['Mãe chamando', 'mae'], ['Pacote da Shopee', 'shopee'], ['Saiu da call', 'call'], ['Tela azul', 'telaAzul'], ['Gol do Brasil', 'gol'],
  ['Era 6 (Zaratustra)', 'zaratustra'], ['Valsa do Danúbio', 'valsa'], ['Destroço desviado', 'lixo'], ['Houston (alarme)', 'houston'],
  ['Consertou com silver tape', 'conserto'],
];

const raiz = document.getElementById('ouvir')!;
const audio = criarAudio();
audio.chaves({ musica: 0, efeitos: true });

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, texto = '') => {
  const e = document.createElement(tag);
  e.textContent = texto;
  return e;
};
const botao = (texto: string, aoTocar: () => void) => {
  const b = el('button', texto);
  b.type = 'button';
  b.addEventListener('click', aoTocar);
  return b;
};

const cab = el('section');
cab.append(el('h1', 'Ouvir o som da Fellas Inc.'), el('p', 'Toca num botão pra ligar o som. No jogo, a era troca no fim do giro (uns 50 s a 1 min).'));

const musica = el('section');
const comecar = el('div');
comecar.className = 'grade';
const mudar = el('div');
mudar.className = 'grade';
const ativos: HTMLButtonElement[] = [];
ERAS.forEach((nome, era) => {
  const b = botao(nome, () => {
    audio.era(era);
    audio.chaves({ musica: 0, efeitos: true });
    audio.chaves({ musica: 1, efeitos: true }); // recomeça já na era escolhida
    ativos.forEach((x) => x.classList.toggle('ativo', x === b));
  });
  ativos.push(b);
  comecar.append(b);
  mudar.append(botao(`→ ${nome}`, () => audio.era(era)));
});
const parar = botao('Parar a música', () => {
  audio.chaves({ musica: 0, efeitos: true });
  ativos.forEach((x) => x.classList.remove('ativo'));
});
musica.append(el('h2', 'Música'), el('p', 'Começar numa era:'), comecar, el('p', 'Trocar como no jogo (no fim do giro):'), mudar, parar);

const efeitos = el('section');
const grade = el('div');
grade.className = 'grade';
for (const [nome, id, o] of EFEITOS) grade.append(botao(nome, () => audio.tocar(id, o)));
efeitos.append(el('h2', 'Efeitos'), grade);

const medir = el('section');
const tabela = el('table');
medir.append(el('h2', 'Medir'), el('p', 'Renderiza cada era (os dois giros) e cada efeito sem tocar e mostra o pico (precisa ficar abaixo de 0 dB).'),
  botao('Medir picos', () => void mostrarMedidas()), tabela);

raiz.append(cab, musica, efeitos, medir);

type Medida = { nome: string; picoDb: number; segundos: number };
const SR = 22050;
async function renderizar(segundos: number, tocar: (ctx: OfflineAudioContext, s: ReturnType<typeof montarSaida>) => void): Promise<number> {
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * segundos), SR);
  tocar(ctx, montarSaida(ctx));
  const buf = await ctx.startRendering();
  let pico = 0;
  for (const v of buf.getChannelData(0)) pico = Math.max(pico, Math.abs(v));
  return 20 * Math.log10(Math.max(pico, 1e-9));
}
async function medirTudo(): Promise<Medida[]> {
  const out: Medida[] = [];
  for (let era = 0; era <= 7; era++) {
    for (const giro of [0, 1]) {
      const spb = 60 / bpm(era);
      const segundos = segundosDoGiro(era);
      const picoDb = await renderizar(segundos + 3, (ctx, s) => {
        const canal = ctx.createGain();
        canal.connect(s.musica);
        if (era >= 6) {
          const sala = criarSala(ctx, s.musica);
          sala.molhado(molhadoDaEra(era), 0);
          canal.connect(sala.entrada);
        }
        for (const n of notasDoGiro(era, giro)) INSTRUMENTOS[n.inst](ctx, canal, n.t * spb, n.altura, n.dur * spb, n.forca);
      });
      out.push({ nome: `${ERAS[era]} · giro ${giro + 1}`, picoDb, segundos });
    }
  }
  for (const [nome, id, o] of EFEITOS) {
    let dura = 0;
    const picoDb = await renderizar(id === 'zaratustra' ? 8 : 3.5, (ctx, s) => {
      dura = RECEITAS[id](ctx, s.efeitos, 0.05, o ?? {});
    });
    out.push({ nome, picoDb, segundos: dura });
  }
  return out;
}
async function mostrarMedidas() {
  tabela.replaceChildren(el('tr'));
  const cabecalho = tabela.firstElementChild!;
  cabecalho.append(el('th', 'O quê'), el('th', 'Pico (dB)'), el('th', 'Duração (s)'));
  for (const m of await medirTudo()) {
    const tr = el('tr');
    const pico = el('td', m.picoDb.toFixed(1));
    if (m.picoDb >= 0) pico.className = 'ruim';
    tr.append(el('td', m.nome), pico, el('td', m.segundos.toFixed(1)));
    tabela.append(tr);
  }
}
(window as unknown as { __medir: typeof medirTudo }).__medir = medirTudo;
