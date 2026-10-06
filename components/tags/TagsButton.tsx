import { useRouter } from 'expo-router';

import { IconButton } from '../ui';

/** Etiquetas no topo do feed no celular: abre a lista de tags (no computador é a barra lateral). */
export function TagsButton() {
  const router = useRouter();
  return <IconButton icon="pricetags-outline" variant="ghost" size="lg" accessibilityLabel="Tags" onPress={() => router.push('/tags')} />;
}
