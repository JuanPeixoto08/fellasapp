import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { cleanPlace, PLACE_MAX } from '../../lib/places';
import { useTheme } from '../../lib/theme';
import { Icon, IconButton } from '../ui';
import { PlaceSuggestions } from './PlaceSuggestions';

type Props = {
  /** Local já escolhido (editar) ou '' (novo). */
  initial: string;
  disabled?: boolean;
  /** Confirmou (sugestão, "Usar…" ou Enter): o local limpo, ou null (vazio ou ✕). */
  onDone: (location: string | null) => void;
};

/** Campo do local no compositor: ícone, texto e fechar, com as sugestões embaixo. */
export function PlaceField({ initial, disabled, onDone }: Props) {
  const t = useTheme();
  const [text, setText] = useState(initial);
  return (
    <View style={{ gap: t.spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          paddingLeft: t.spacing.md,
          borderWidth: t.borders.hairline,
          borderColor: t.colors.border,
          borderRadius: t.radii.md,
          backgroundColor: t.colors.surface,
        }}
      >
        <Icon name="location-outline" size="sm" tone="muted" />
        <TextInput
          autoFocus
          accessibilityLabel="Local"
          placeholder="Onde você tá?"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.primary}
          value={text}
          onChangeText={setText}
          maxLength={PLACE_MAX}
          editable={!disabled}
          returnKeyType="done"
          onSubmitEditing={() => onDone(cleanPlace(text))}
          style={[t.typography.body, { flex: 1, minHeight: t.layout.minTouch, color: t.colors.text }]}
        />
        <IconButton
          icon="close"
          accessibilityLabel="Fechar local"
          variant="ghost"
          tone="muted"
          size="sm"
          disabled={disabled}
          onPress={() => onDone(null)}
        />
      </View>
      <PlaceSuggestions query={text} onPick={(name) => onDone(cleanPlace(name))} />
    </View>
  );
}
