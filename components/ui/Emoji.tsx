import { useState } from 'react';
import { Image } from 'react-native';

import { twemojiUrl } from '../../lib/twemoji';
import { useTheme, type EmojiSize } from '../../lib/theme';
import { Text } from './Text';

export type EmojiProps = { emoji: string; size?: EmojiSize };

/**
 * Emoji desenhado pelo app (Twemoji), igual em qualquer aparelho. Decorativo: quem o contém diz o
 * emoji no rótulo acessível. Se a imagem não carregar (sem internet, emoji novo demais), usa o do aparelho.
 */
export function Emoji({ emoji, size = 'md' }: EmojiProps) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const px = t.emojiSizes[size];
  if (failed) {
    return <Text style={{ fontSize: px, lineHeight: Math.round(px * 1.25) }}>{emoji}</Text>;
  }
  return (
    <Image
      testID={`emoji-${emoji}`}
      source={{ uri: twemojiUrl(emoji) }}
      onError={() => setFailed(true)}
      accessible={false}
      style={{ width: px, height: px }}
    />
  );
}
