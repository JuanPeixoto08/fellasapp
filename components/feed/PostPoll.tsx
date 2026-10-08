import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { PollVoteError, votePoll, type FeedPoll } from '../../lib/api/posts';
import { pollPercents, pollTimeLeft, pollWinners, votesLabel } from '../../lib/polls';
import { useTheme } from '../../lib/theme';
import { Icon, interactiveStyle, Text } from '../ui';

type Props = { postId: string; poll: FeedPoll };

/**
 * Enquete no post: uma linha por opção com a barra da porcentagem atrás (sempre visível), a minha com ✓.
 * Aberta e sem meu voto, tocar numa opção vota na hora (definitivo). Embaixo, total e tempo restante.
 */
export function PostPoll({ postId, poll }: Props) {
  const t = useTheme();
  // voto otimista: vale até o post voltar do banco já com o meu voto
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const left = pollTimeLeft(poll.endsAt, now);
  const isOpen = left !== null;

  // enquanto aberta, o tempo restante (e o fim) se atualiza sozinho
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const myVote = poll.myVote ?? pending;
  const counts =
    poll.myVote === null && pending !== null ? poll.counts.map((c, i) => (i === pending ? c + 1 : c)) : poll.counts;
  const total = counts.reduce((a, b) => a + b, 0);
  const percents = pollPercents(counts);
  const winners = isOpen ? [] : pollWinners(counts);
  const canVote = isOpen && myVote === null;

  const vote = async (option: number) => {
    setError(null);
    setPending(option);
    try {
      await votePoll(postId, option);
    } catch (e) {
      // já votei (outra aba/aparelho): o voto vale, o post atualiza sozinho
      if (e instanceof PollVoteError && e.kind === 'voted') return;
      setPending(null);
      setError(e instanceof PollVoteError ? e.message : 'Não rolou votar. Tenta de novo.');
    }
  };

  return (
    <View style={{ gap: t.spacing.xs }}>
      {poll.options.map((label, i) => {
        const mine = myVote === i;
        const strong = mine || winners.includes(i);
        const row = (
          <>
            {/* a barra da porcentagem, atrás do texto */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: `${percents[i]}%`,
                backgroundColor: mine ? t.colors.brandSoft : t.colors.surfaceSunken,
              }}
            />
            <Text bold={strong} numberOfLines={1} style={{ flex: 1 }}>
              {label}
            </Text>
            {mine ? <Icon name="checkmark" size="sm" color={t.colors.brand} /> : null}
            <Text bold={strong}>{percents[i]}%</Text>
          </>
        );
        const box = {
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: t.spacing.sm,
          minHeight: t.layout.minTouch,
          paddingHorizontal: t.spacing.md,
          borderRadius: t.radii.md,
          overflow: 'hidden' as const,
        };
        if (canVote) {
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Votar em ${label}`}
              accessibilityHint={`${percents[i]}% até agora`}
              onPress={() => void vote(i)}
              // dá pra votar: contorno fino, como os botões de enquete do Twitter
              style={(state) => ({
                ...interactiveStyle(t, state),
                ...box,
                borderWidth: t.borders.hairline,
                borderColor: t.colors.border,
              })}
            >
              {row}
            </Pressable>
          );
        }
        return (
          <View
            key={i}
            accessible
            accessibilityLabel={`${label}, ${percents[i]}%${mine ? ', seu voto' : ''}`}
            style={box}
          >
            {row}
          </View>
        );
      })}
      <Text variant="caption" tone="muted">
        {votesLabel(total)} · {left ?? 'Resultado final'}
      </Text>
      {error ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
