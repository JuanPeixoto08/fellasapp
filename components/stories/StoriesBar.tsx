import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { StoryGroup } from '../../lib/api/stories';
import { useSession } from '../../lib/auth/SessionProvider';
import { openStories } from '../../lib/storyViewerStore';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';
import { useStories } from '../../lib/useStories';
import { Avatar, Icon, Text } from '../ui';
import { StoryComposer } from './StoryComposer';

/** Avatar com anel: `brand` quando tem story não visto, `border` quando já vi tudo. */
function Ring({ name, uri, fresh }: { name: string; uri: string | null; fresh: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        padding: t.borders.selected,
        borderRadius: t.radii.pill,
        borderWidth: t.borders.selected,
        borderColor: fresh ? t.colors.brand : t.colors.border,
      }}
    >
      <Avatar name={name} uri={uri} size={t.avatarSizes.lg} />
    </View>
  );
}

/** Faixa de stories no topo do feed: o meu (postar/ver) e o de cada fella com story nas últimas 24 h. */
export function StoriesBar() {
  const t = useTheme();
  const myId = useSession().session?.user.id;
  const me = useMyAvatar();
  const { groups } = useStories();
  const [composing, setComposing] = useState(false);
  const mine: StoryGroup | undefined = groups.find((g) => g.author.id === myId);
  const others = groups.filter((g) => g.author.id !== myId);
  const caption = (name: string) => name.split(' ')[0];

  const plus = (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: t.iconSizes.lg,
        height: t.iconSizes.lg,
        borderRadius: t.radii.pill,
        backgroundColor: t.colors.brand,
        borderWidth: t.borders.selected,
        borderColor: t.colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="add" size="sm" color={t.colors.onBrand} />
    </View>
  );

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.layout.gutter, paddingVertical: t.spacing.md, gap: t.spacing.md }}
      >
        <View style={{ alignItems: 'center', gap: t.spacing.xs }}>
          {mine ? (
            <View>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver meu story" onPress={() => openStories(groups, mine.author.id)}>
                <Ring name={me.name} uri={me.uri} fresh={mine.hasUnseen} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Postar story"
                onPress={() => setComposing(true)}
                hitSlop={t.spacing.sm}
                style={{ position: 'absolute', right: 0, bottom: 0, width: t.iconSizes.lg, height: t.iconSizes.lg }}
              >
                {plus}
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel="Postar story" onPress={() => setComposing(true)}>
              <Ring name={me.name} uri={me.uri} fresh={false} />
              {plus}
            </Pressable>
          )}
          <Text variant="caption" tone="muted" numberOfLines={1}>
            Seu story
          </Text>
        </View>

        {others.map((g) => (
          <Pressable
            key={g.author.id}
            accessibilityRole="button"
            accessibilityLabel={g.hasUnseen ? `Stories de ${g.author.name}, tem novidade` : `Stories de ${g.author.name}`}
            onPress={() => openStories(groups, g.author.id)}
            style={{ alignItems: 'center', gap: t.spacing.xs, maxWidth: t.avatarSizes.lg + t.spacing.xl }}
          >
            <Ring name={g.author.name} uri={g.author.avatarUrl} fresh={g.hasUnseen} />
            <Text variant="caption" numberOfLines={1} tone={g.hasUnseen ? 'default' : 'muted'}>
              {caption(g.author.name)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <StoryComposer visible={composing} onClose={() => setComposing(false)} />
    </>
  );
}
