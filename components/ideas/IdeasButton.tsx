import { useRouter } from 'expo-router';

import { IconButton } from '../ui';

/** Lâmpada do topo do feed no celular (no computador a entrada é a barra lateral). */
export function IdeasButton() {
  const router = useRouter();
  return <IconButton icon="bulb-outline" variant="ghost" size="lg" accessibilityLabel="Ideias" onPress={() => router.push('/ideas')} />;
}
