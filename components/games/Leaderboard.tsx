import { Fragment } from 'react';
import { View } from 'react-native';

import type { LeaderRow } from '../../lib/api/games';
import { useTheme } from '../../lib/theme';
import { Avatar, Divider, Text } from '../ui';

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Placar da semana: rosto e nome antes do número; a minha linha em `brandSoft`. */
export function Leaderboard({ rows, me, loading }: { rows: LeaderRow[]; me: string | null; loading: boolean }) {
  const t = useTheme();

  if (loading) {
    return (
      <View accessible accessibilityLabel="Carregando o placar">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.layout.minTouch + t.spacing.sm }}>
            <View style={{ width: t.avatarSizes.sm, height: t.avatarSizes.sm, borderRadius: t.radii.pill, backgroundColor: t.colors.surfaceSunken }} />
            <View style={{ flex: 1, height: t.spacing.md, borderRadius: t.radii.sm, backgroundColor: t.colors.surfaceSunken }} />
          </View>
        ))}
      </View>
    );
  }

  if (!rows.length) {
    return <Text tone="muted">Ninguém jogou essa semana ainda. Abre os trabalhos.</Text>;
  }

  return (
    <View>
      {rows.map((r, i) => {
        const mine = r.userId === me;
        return (
          <Fragment key={r.userId}>
            {i > 0 ? <Divider /> : null}
            <View
              testID={mine ? 'board-row-me' : undefined}
              accessible
              accessibilityLabel={`${i + 1}º, ${mine ? 'você' : r.name}, ${fmt(r.balance)} créditos${
                r.fiadoCount ? `, ${r.fiadoCount} fiado` : ''
              }`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.md,
                minHeight: t.layout.minTouch + t.spacing.sm,
                paddingHorizontal: t.spacing.sm,
                marginHorizontal: -t.spacing.sm,
                borderRadius: t.radii.md,
                backgroundColor: mine ? t.colors.brandSoft : 'transparent',
              }}
            >
              <Text variant="small" tone="muted" style={{ minWidth: t.spacing.lg, fontVariant: ['tabular-nums'] }}>
                {i + 1}
              </Text>
              <Avatar name={r.name} uri={r.avatarUrl} size={t.avatarSizes.sm} />
              <Text numberOfLines={1} style={{ flex: 1 }}>
                <Text bold>{mine ? 'Você' : r.name}</Text>
                {r.fiadoCount ? (
                  <Text variant="small" tone="muted">
                    {` · ${r.fiadoCount} fiado${r.fiadoCount > 1 ? 's' : ''}`}
                  </Text>
                ) : null}
              </Text>
              <Text bold style={{ fontVariant: ['tabular-nums'] }}>
                {fmt(r.balance)}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
