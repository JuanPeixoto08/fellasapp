import { closeEmojiPicker, useEmojiPickerRequest } from '../../lib/emojiPickerStore';
import { EmojiPicker } from './EmojiPicker';

/** Desenha o seletor completo de emojis pedido por qualquer barra de reações (montado uma vez, na raiz). */
export function EmojiPickerHost() {
  const request = useEmojiPickerRequest();
  if (!request) return null;
  return (
    <EmojiPicker
      visible
      selected={request.selected}
      anchor={request.anchor}
      onSelect={(emoji) => {
        closeEmojiPicker();
        request.onSelect(emoji);
      }}
      onClose={() => {
        closeEmojiPicker();
        request.onClose();
      }}
    />
  );
}
