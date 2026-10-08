import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { ChampionRow, GameList, WalletRow } from '../../components/games/GameRows';
import { Leaderboard } from '../../components/games/Leaderboard';
import { useContentWidth } from '../../components/shell/ShellContext';
import { EmptyState, Heading, Screen, Text } from '../../components/ui';
import {
  GAMES_ERRORS,
  gamesErrorMessage,
  getLastChampion,
  getLeaderboard,
  getWallet,
  takeFiado,
  withMember,
  type Champion,
  type LeaderRow,
  type Wallet,
} from '../../lib/api/games';
import { useSession } from '../../lib/auth/SessionProvider';
import { openGame } from '../../lib/games';
import { useMemberDirectory } from '../../lib/memberDirectory';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';

type Data = { wallet: Wallet; board: LeaderRow[]; champion: Champion | null };

/**
 * Fellas Games: meus créditos da semana, os jogos, o campeão da semana passada e o placar. Os créditos são de
 * mentira; quem mexe neles é o banco. Recarrega toda vez que a aba ganha foco (voltou da mesa, outra pessoa jogou).
 */
export default function GamesScreen() {
  const t = useTheme();
  const width = useContentWidth();
  const me = useSession().session?.user.id ?? null;
  const avatar = useMyAvatar();
  const [loaded, setData] = useState<Data | null>(null);
  // nomes e fotos pelo diretório na hora de desenhar: atualizam quando a lista de fellas chega
  const members = useMemberDirectory();
  const data = useMemo<Data | null>(
    () =>
      loaded && {
        ...loaded,
        board: loaded.board.map((r) => withMember(r, members)),
        champion: loaded.champion && withMember(loaded.champion, members),
      },
    [loaded, members],
  );
  const [failed, setFailed] = useState(false);
  const [fiadoBusy, setFiadoBusy] = useState(false);
  const [fiadoMessage, setFiadoMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [wallet, board, champion] = await Promise.all([getWallet(), getLeaderboard(), getLastChampion()]);
      setData({ wallet, board, champion });
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function fiado() {
    setFiadoBusy(true);
    setFiadoMessage(null);
    try {
      const wallet = await takeFiado();
      setData((d) => (d ? { ...d, wallet } : d));
    } catch (e) {
      setFiadoMessage(gamesErrorMessage(e));
    } finally {
      setFiadoBusy(false);
    }
  }

  if (failed && !data) {
    return (
      <Screen header>
        <EmptyState title="O placar não veio" message={GAMES_ERRORS.load} actionLabel="Tentar de novo" onAction={() => void load()} />
      </Screen>
    );
  }

  const position = data ? data.board.findIndex((r) => r.userId === me) + 1 || null : null;
  const section = (title: string, body: ReactNode) => (
    <View style={{ gap: t.spacing.md }}>
      <Heading level={3}>{title}</Heading>
      {body}
    </View>
  );

  const mine = data
    ? section(
        'Seus créditos',
        <WalletRow
          name={avatar.name}
          avatarUri={avatar.uri}
          wallet={data.wallet}
          position={position}
          fiadoBusy={fiadoBusy}
          fiadoMessage={fiadoMessage}
          onFiado={() => void fiado()}
        />,
      )
    : null;
  const games = data
    ? section('Jogos', <GameList openRound={!!data.wallet.openRoundId} onBlackjack={() => openGame('blackjack')} />)
    : null;
  const champion = data?.champion ? section('Campeão da semana passada', <ChampionRow champion={data.champion} />) : null;
  const board = section('Placar da semana', <Leaderboard rows={data?.board ?? []} me={me} loading={!data} />);

  const intro = (
    <Text variant="small" tone="muted">
      Todo mundo começa a semana com 1.000. Zera segunda à meia-noite.
    </Text>
  );
  const twoColumns = width >= t.layout.breakpoints.medium;

  return (
    <Screen header scroll style={{ maxWidth: width, gap: t.spacing.xl }}>
      {intro}
      {twoColumns ? (
        <View style={{ flexDirection: 'row', gap: t.spacing.xxl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.1, gap: t.spacing.xl }}>
            {champion}
            {board}
          </View>
          <View style={{ flex: 1, gap: t.spacing.xl }}>
            {mine}
            {games}
          </View>
        </View>
      ) : (
        <>
          {mine}
          {games}
          {champion}
          {board}
        </>
      )}
    </Screen>
  );
}
