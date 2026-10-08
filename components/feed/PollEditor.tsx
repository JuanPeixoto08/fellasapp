import { Pressable, View } from 'react-native';

import {
  dayOptions,
  hourOptions,
  minuteOptions,
  normalizeDuration,
  POLL_LIMITS,
  type PollDuration,
} from '../../lib/polls';
import { useTheme } from '../../lib/theme';
import { IconButton, interactiveStyle, Select, Text, TextField } from '../ui';

export type PollDraft = { options: string[]; duration: PollDuration };

type Props = {
  poll: PollDraft;
  onChange: (poll: PollDraft) => void;
  onRemove: () => void;
  disabled?: boolean;
};

const asOptions = (values: number[]) => values.map((v) => ({ value: v, label: String(v) }));

/**
 * Caixa da enquete no compositor, como no Twitter: opções (2 a 4, até 25 caracteres), "+" ao lado da
 * última, duração em Dias / Horas / Minutos e "Remover enquete".
 */
export function PollEditor({ poll, onChange, onRemove, disabled }: Props) {
  const t = useTheme();
  const { options, duration } = poll;
  const setOption = (i: number, text: string) => onChange({ ...poll, options: options.map((o, j) => (j === i ? text : o)) });
  const setDuration = (next: Partial<PollDuration>) =>
    onChange({ ...poll, duration: normalizeDuration({ ...duration, ...next }) });
  const canAdd = options.length < POLL_LIMITS.maxOptions;
  const section = { padding: t.spacing.md, gap: t.spacing.sm };
  const rule = { borderTopWidth: t.borders.hairline, borderColor: t.colors.border };

  return (
    <View
      testID="poll-editor"
      style={{ borderWidth: t.borders.hairline, borderColor: t.colors.border, borderRadius: t.radii.lg, overflow: 'hidden' }}
    >
      <View style={section}>
        {options.map((text, i) => {
          const last = i === options.length - 1;
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label={`Opção ${i + 1}`}
                  hideLabel
                  placeholder={`Opção ${i + 1}`}
                  maxLength={POLL_LIMITS.optionLength}
                  value={text}
                  onChangeText={(v) => setOption(i, v)}
                  editable={!disabled}
                />
              </View>
              {/* um lugar só à direita: "+" na última (até 4), ✕ nas que passam de 2, vazio nas outras
                  (opção vazia não vai pro post, então a 3ª com "+" não precisa de ✕) */}
              {last && canAdd ? (
                <IconButton
                  icon="add"
                  accessibilityLabel="Adicionar opção"
                  variant="ghost"
                  onPress={() => onChange({ ...poll, options: [...options, ''] })}
                  disabled={disabled}
                />
              ) : i >= POLL_LIMITS.minOptions ? (
                <IconButton
                  icon="close"
                  accessibilityLabel={`Tirar opção ${i + 1}`}
                  variant="ghost"
                  tone="muted"
                  onPress={() => onChange({ ...poll, options: options.filter((_, j) => j !== i) })}
                  disabled={disabled}
                />
              ) : (
                <View style={{ width: t.layout.minTouch }} />
              )}
            </View>
          );
        })}
      </View>
      <View style={[section, rule]}>
        <Text variant="small" bold>
          Duração da enquete
        </Text>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Select
            label="Dias"
            value={duration.days}
            options={asOptions(dayOptions())}
            onChange={(days) => setDuration({ days })}
            disabled={disabled}
          />
          <Select
            label="Horas"
            value={duration.hours}
            options={asOptions(hourOptions(duration))}
            onChange={(hours) => setDuration({ hours })}
            disabled={disabled}
          />
          <Select
            label="Minutos"
            value={duration.minutes}
            options={asOptions(minuteOptions(duration))}
            onChange={(minutes) => setDuration({ minutes })}
            disabled={disabled}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remover enquete"
        onPress={onRemove}
        disabled={disabled}
        style={(state) => ({
          ...interactiveStyle(t, state),
          ...rule,
          minHeight: t.layout.minTouch,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Text tone="danger">Remover enquete</Text>
      </Pressable>
    </View>
  );
}
