import { act, render } from '@testing-library/react-native';
import { AppState, Platform } from 'react-native';

const mockNewVersion = jest.fn();
jest.mock('../lib/appUpdate', () => ({ ...jest.requireActual('../lib/appUpdate'), newVersion: () => mockNewVersion() }));

import { AppUpdater, UPDATE_CHECK_MS } from '../components/shell/AppUpdater';
import { clearDraft, setDraft } from '../lib/composerDraft';

const { entryOf, newVersion } = jest.requireActual('../lib/appUpdate');

const OLD = '/_expo/static/js/web/entry-171ee776603853487c78a9fa573ee165.js';
const NEW = '/_expo/static/js/web/entry-9b0c2f1d7e3a4b5c6d7e8f9a0b1c2d3e.js';
const page = (src: string) => `<html><head></head><body><script src="${src}" defer></script></body></html>`;

describe('entryOf', () => {
  it('acha o bundle no index.html; sem bundle, null', () => {
    expect(entryOf(page(OLD))).toBe(OLD);
    expect(entryOf('<html></html>')).toBeNull();
  });
});

describe('newVersion', () => {
  const g = globalThis as { document?: unknown };
  beforeEach(() => {
    g.document = { querySelectorAll: () => [{ getAttribute: () => OLD }] };
  });
  afterEach(() => {
    delete g.document;
  });
  const res = (body: string, ok = true) => Promise.resolve({ ok, text: () => Promise.resolve(body) } as Response);

  it('servidor com outro bundle: tem versão nova (busca sem cache)', async () => {
    const fetchMock = jest.fn(() => res(page(NEW)));
    await expect(newVersion(fetchMock)).resolves.toBe(NEW);
    expect(fetchMock).toHaveBeenCalledWith('/', { cache: 'no-store' });
  });

  it('mesmo bundle, erro do servidor ou sem rede: nada', async () => {
    await expect(newVersion(() => res(page(OLD)))).resolves.toBeNull();
    await expect(newVersion(() => res('', false))).resolves.toBeNull();
    await expect(newVersion(() => Promise.reject(new Error('offline')))).resolves.toBeNull();
  });

  it('página sem bundle conhecido (modo dev) ou fora da web: nem busca', async () => {
    g.document = { querySelectorAll: () => [] };
    const fetchMock = jest.fn(() => res(page(NEW)));
    await expect(newVersion(fetchMock)).resolves.toBeNull();
    delete g.document;
    await expect(newVersion(fetchMock)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const store = new Map<string, string>();
(globalThis as { sessionStorage?: unknown }).sessionStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
};

describe('AppUpdater', () => {
  let handler: (state: string) => void = () => {};
  const os = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'web';
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, h) => {
        handler = h as (state: string) => void;
        return { remove: jest.fn() } as never;
      })
      .mockClear();
    mockNewVersion.mockReset().mockResolvedValue(NEW);
    store.clear();
    clearDraft();
  });
  afterEach(() => {
    Platform.OS = os;
    jest.restoreAllMocks();
  });
  const back = async () => {
    await act(async () => {
      handler('active');
    });
  };

  it('voltou pro app e saiu versão nova: recarrega', async () => {
    const reload = jest.fn();
    await render(<AppUpdater reload={reload} />);
    await back();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('abrindo o app (página restaurada do cache do Chrome): confere na hora e recarrega se tiver versão nova', async () => {
    const reload = jest.fn();
    await render(<AppUpdater reload={reload} />);
    await act(async () => {});
    expect(mockNewVersion).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('não recarrega duas vezes pelo mesmo bundle na mesma aba (página recarregada ainda velha)', async () => {
    const reload = jest.fn();
    await render(<AppUpdater reload={reload} />);
    await act(async () => {});
    await render(<AppUpdater reload={reload} />);
    await act(async () => {});
    expect(mockNewVersion).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('sem versão nova: não recarrega', async () => {
    mockNewVersion.mockResolvedValue(null);
    const reload = jest.fn();
    await render(<AppUpdater reload={reload} />);
    await back();
    expect(reload).not.toHaveBeenCalled();
  });

  it('com post sendo escrito: espera (não perde o rascunho)', async () => {
    setDraft((d) => ({ ...d, body: 'meio escrito' }));
    const reload = jest.fn();
    await render(<AppUpdater reload={reload} />);
    await back();
    expect(reload).not.toHaveBeenCalled();
  });

  it('indo pro segundo plano não confere; voltar em menos de 1 min da última conferência também não', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    mockNewVersion.mockResolvedValue(null);
    await render(<AppUpdater reload={jest.fn()} />);
    await act(async () => {
      handler('background');
    });
    // só a de quando abriu
    expect(mockNewVersion).toHaveBeenCalledTimes(1);
    await back();
    await back();
    expect(mockNewVersion).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1_000_000 + UPDATE_CHECK_MS);
    await back();
    expect(mockNewVersion).toHaveBeenCalledTimes(2);
  });

  it('no app nativo não faz nada', async () => {
    Platform.OS = 'ios';
    await render(<AppUpdater reload={jest.fn()} />);
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });
});
