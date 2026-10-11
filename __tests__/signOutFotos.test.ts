jest.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: jest.fn(async () => ({ error: null })) }, storage: { from: () => ({}) } },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { signOut } from '../lib/api/auth';
import { SIGNED_URL_KEY } from '../lib/api/storage';

describe('sair da conta', () => {
  it('apaga os links de foto guardados no aparelho', async () => {
    await AsyncStorage.setItem(SIGNED_URL_KEY, JSON.stringify({ 'u1/a.jpg': { url: 'https://signed/a', expiresAt: Date.now() + 1e6 } }));
    await signOut();
    expect(await AsyncStorage.getItem(SIGNED_URL_KEY)).toBeNull();
  });
});
