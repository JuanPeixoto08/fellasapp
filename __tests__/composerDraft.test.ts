import { renderHook } from '@testing-library/react-native';

import { clearDraft, setDraft, useClearDraftOnUserChange, useDraft } from '../lib/composerDraft';

beforeEach(() => clearDraft());

describe('rascunho e troca de usuário', () => {
  it('logout (usuário some) limpa o rascunho: a próxima pessoa no aparelho não vê nem posta o texto', async () => {
    const { rerender } = await renderHook(({ id }: { id?: string }) => useClearDraftOnUserChange(id), {
      initialProps: { id: 'ana' },
    });
    setDraft({ body: 'segredo da Ana', imageUris: ['file://a.jpg'] });
    await rerender({ id: undefined });
    const { result } = await renderHook(() => useDraft());
    expect(result.current).toEqual({ body: '', imageUris: [] });
  });

  it('trocar de conta direto também limpa', async () => {
    const { rerender } = await renderHook(({ id }: { id?: string }) => useClearDraftOnUserChange(id), {
      initialProps: { id: 'ana' },
    });
    setDraft({ body: 'da Ana', imageUris: [] });
    await rerender({ id: 'bia' });
    const { result } = await renderHook(() => useDraft());
    expect(result.current.body).toBe('');
  });

  it('o mesmo usuário (re-render, token renovado) mantém o rascunho', async () => {
    const { rerender } = await renderHook(({ id }: { id?: string }) => useClearDraftOnUserChange(id), {
      initialProps: { id: 'ana' },
    });
    setDraft({ body: 'continua', imageUris: [] });
    await rerender({ id: 'ana' });
    const { result } = await renderHook(() => useDraft());
    expect(result.current.body).toBe('continua');
  });
});
