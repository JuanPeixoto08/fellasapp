import { View } from 'react-native';

import { postTime } from '../../lib/format';
import type { Idea } from '../../lib/ideas';
import { useTheme } from '../../lib/theme';
import { Avatar, IconButton, Text } from '../ui';
import { VoteColumn } from './VoteColumn';

type Props = { idea: Idea; canDelete: boolean; onVote: (tapped: 1 | -1) => void; onDelete: () => void };

/** Uma ideia no padrão "sem caixa" do feed: votos à esquerda, texto e autor à direita. */
export function IdeaRow({ idea, canDelete, onVote, onDelete }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
      <VoteColumn score={idea.score} myVote={idea.myVote} onVote={onVote} context={idea.body} />
      <View style={{ flex: 1, gap: t.spacing.sm, paddingTop: t.spacing.md }}>
        <Text>{idea.body}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Avatar name={idea.author.name} uri={idea.author.avatarUrl} size={t.avatarSizes.sm} />
          <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
            {idea.author.name}
          </Text>
          <Text variant="small" tone="muted">
            {postTime(idea.createdAt)}
          </Text>
          <View style={{ flex: 1 }} />
          {canDelete ? (
            <IconButton icon="trash-outline" variant="ghost" tone="muted" accessibilityLabel="Apagar ideia" onPress={onDelete} />
          ) : null}
        </View>
      </View>
    </View>
  );
}
