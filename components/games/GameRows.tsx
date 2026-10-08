import { View } from 'react-native';

import { GAMES_ERRORS, MIN_BET, type Champion, type PokerTable, type Wallet } from '../../lib/api/games';
import { useTheme } from '../../lib/theme';
import { Avatar, Button, Divider, Text, TrophyBadge } from '../ui';
import { TableArt } from './TableArt';

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Eu, meu saldo e minha posição; o fiado aparece quando não dá pra apostar. */
export function WalletRow({
  name,
  avatarUri,
  wallet,
  position,
  fiadoBusy,
  fiadoMessage,
  onFiado,
}: {
  name: string;
  avatarUri: string | null;
  wallet: Wallet;
  position: number | null;
  fiadoBusy: boolean;
  fiadoMessage: string | null;
  onFiado: () => void;
}) {
  const t = useTheme();
  const seated = wallet.seatedStack !== null;
  // sem dar pra apostar: sentado no poker, primeiro levanta; sem mão aberta e sem fiado liberado, o de hoje já foi
  const note =
    fiadoMessage ??
    (wallet.balance < MIN_BET
      ? seated
        ? GAMES_ERRORS.fiadoSeated
        : !wallet.canFiado && !wallet.openRoundId
          ? GAMES_ERRORS.fiadoToday
          : null
      : null);
  return (
    <View style={{ gap: t.spacing.md }}>
      <View
        accessible
        accessibilityLabel={`Seus créditos: ${fmt(wallet.balance)}${seated ? `, mais ${fmt(wallet.seatedStack!)} na mesa de poker` : ''}. ${position ? `${position}º lugar` : 'Fora do placar até a primeira mão'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}
      >
        <Avatar name={name} uri={avatarUri} size={t.avatarSizes.lg} />
        <View style={{ flex: 1 }}>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {fmt(wallet.balance)}
          </Text>
          <Text variant="small" tone="muted">
            {position ? `${position}º lugar` : 'Fora do placar até a primeira mão'}
          </Text>
          {seated ? (
            <Text variant="small" tone="muted">{`+ ${fmt(wallet.seatedStack!)} na mesa de poker`}</Text>
          ) : null}
        </View>
      </View>
      {wallet.canFiado ? (
        <Button title="Pegar fiado (+100)" variant="secondary" loading={fiadoBusy} onPress={onFiado} />
      ) : null}
      {note ? (
        <Text variant="small" tone="muted">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** Um jogo: a mesa em miniatura, o nome, como joga e o botão. Sem `onPlay` = em breve. */
export function GameRow({
  title,
  subtitle,
  meta,
  art,
  playLabel,
  onPlay,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  art: Parameters<typeof TableArt>[0]['cards'];
  playLabel?: string;
  onPlay?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md }}>
      <TableArt cards={art} muted={!onPlay} />
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <Text variant="lead" bold>
          {title}
        </Text>
        <Text variant="small" tone="muted">
          {subtitle}
        </Text>
        {meta ? (
          <Text variant="small" tone="muted">
            {meta}
          </Text>
        ) : null}
      </View>
      {onPlay ? (
        <Button title={playLabel ?? 'Jogar'} accessibilityLabel={`${playLabel ?? 'Jogar'} ${title}`} onPress={onPlay} />
      ) : (
        <Text variant="small" tone="muted">
          Em breve
        </Text>
      )}
    </View>
  );
}

export function GameList({
  openRound,
  onBlackjack,
  poker,
  onPoker,
}: {
  openRound: boolean;
  onBlackjack: () => void;
  poker: PokerTable | null;
  onPoker: () => void;
}) {
  return (
    <View>
      <GameRow
        title="Blackjack"
        subtitle="Você contra a banca · 10 a 500"
        art={[
          { rank: 'A', suit: '♠', red: false },
          { rank: 'K', suit: '♥', red: true },
        ]}
        playLabel={openRound ? 'Continuar mão' : 'Jogar'}
        onPlay={onBlackjack}
      />
      <Divider />
      <GameRow
        title="Poker"
        subtitle="Texas Hold'em · 2 a 6 fellas · entrada 200 a 500"
        meta={poker ? (poker.count ? `${poker.count} na mesa` : 'Mesa vazia') : undefined}
        art={[
          { rank: 'Q', suit: '♣', red: false },
          { rank: 'Q', suit: '♦', red: true },
        ]}
        playLabel={poker?.seated ? 'Voltar pra mesa' : 'Jogar'}
        onPlay={onPoker}
      />
    </View>
  );
}

/** Campeão da semana que fechou: rosto, nome com o troféu e com quanto fechou. */
export function ChampionRow({ champion }: { champion: Champion }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
      <Avatar name={champion.name} uri={champion.avatarUrl} size={t.avatarSizes.md} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <Text bold numberOfLines={1}>
            {champion.name}
          </Text>
          <TrophyBadge />
        </View>
        <Text variant="small" tone="muted">{`fechou com ${fmt(champion.balance)}`}</Text>
      </View>
    </View>
  );
}
