import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdeaRow } from '../components/ideas/IdeaRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Button, ConfirmDialog, Divider, EmptyState, Screen, Tabs, Text, TextField } from '../components/ui';
import { IDEA_ERRORS, ideaErrorMessage } from '../lib/api/ideas';
import { useSession } from '../lib/auth/SessionProvider';
import { IDEA_MAX, remainingLabel, validateIdea, type IdeaSort } from '../lib/ideas';
import { useTheme } from '../lib/theme';
import { useIdeas } from '../lib/useIdeas';

const TABS: { key: IdeaSort; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'Novas' },
];

export default function IdeasScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session, profile } = useSession();
  const me = session?.user.id;
  const isAdmin = !!profile?.is_admin;
  const { sort, setSort, ideas, loading, error, notice, reload, vote, create, remove } = useIdeas(me);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [toDelete, setToDelete] = useState<string | null>(null);

  async function send() {
    if (sending || !validateIdea(text)) return;
    setSending(true);
    setSendError(undefined);
    try {
      await create(text);
      setText('');
    } catch (e) {
      setSendError(ideaErrorMessage(e, 'create'));
    } finally {
      setSending(false);
    }
  }

  const header = (
    <View style={{ gap: t.spacing.lg, paddingTop: t.spacing.lg }}>
      <View style={{ gap: t.spacing.md }}>
        <TextField
          label="Manda sua ideia"
          placeholder="Que tal se o app…"
          multiline
          maxLength={IDEA_MAX}
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (sendError) setSendError(undefined);
          }}
          error={sendError}
          help={remainingLabel(text) ?? undefined}
          editable={!sending}
        />
        <Button title="Mandar" onPress={() => void send()} loading={sending} disabled={!validateIdea(text)} />
      </View>
      <Tabs items={TABS} value={sort} onChange={setSort} />
      {notice ? (
        <Text variant="small" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
    </View>
  );

  let empty;
  if (loading) {
    empty = (
      <View style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.xl }}>
        <ActivityIndicator color={t.colors.primary} />
        <Text tone="muted">Juntando as ideias…</Text>
      </View>
    );
  } else if (error) {
    empty = <EmptyState title="Não deu pra carregar as ideias" message={error} actionLabel="Tentar de novo" onAction={reload} />;
  } else {
    empty = <EmptyState title="Ninguém deu ideia ainda." message="Solta a primeira aí em cima." />;
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Ideias')} />
      <Screen header>
        <FlatList
          data={loading || error ? [] : ideas}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ItemSeparatorComponent={Divider}
          contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
          renderItem={({ item }) => (
            <IdeaRow
              idea={item}
              canDelete={item.author.id === me || isAdmin}
              onVote={(dir) => vote(item.id, dir)}
              onDelete={() => setToDelete(item.id)}
            />
          )}
        />
      </Screen>
      <ConfirmDialog
        visible={toDelete !== null}
        title="Apagar essa ideia?"
        message="Os votos dela somem junto."
        confirmLabel="Apagar"
        errorMessage={IDEA_ERRORS.remove}
        onConfirm={async () => {
          if (!toDelete) return;
          await remove(toDelete);
          setToDelete(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
