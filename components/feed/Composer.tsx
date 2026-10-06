import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { createPost, MAX_IMAGES } from '../../lib/api/posts';
import { clearDraft, setDraft, useDraft } from '../../lib/composerDraft';
import { friendlyError } from '../../lib/errors';
import { activeMention, insertMention } from '../../lib/mentions';
import { activeTag, insertTag } from '../../lib/tags';
import { cleanPlace } from '../../lib/places';
import { addPasted, usePasteImages } from '../../lib/pasteImages';
import { emitPostCreated } from '../../lib/postEvents';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';
import { MentionSuggestions } from '../MentionSuggestions';
import { TagSuggestions } from '../TagSuggestions';
import { PlaceChip } from '../places/PlaceChip';
import { PlaceField } from '../places/PlaceField';
import { useContentWidth } from '../shell/ShellContext';
import { Avatar, Button, ConfirmDialog, Icon, IconButton, Text, useAutoGrow } from '../ui';

/** Mesmo limite do check posts_body_check (0001). */
const MAX_BODY = 2000;
/** O contador só aparece perto do limite, para não virar ruído. */
const COUNTER_FROM = MAX_BODY - 200;

export type ComposerVariant = 'page' | 'inline' | 'dialog';

type Props = {
  variant: ComposerVariant;
  /** Depois de postar (página: ir pro feed; janela: fechar). */
  onPosted?: () => void;
  /** Cancelar/fechar (página e janela). Com rascunho, confirma o descarte antes. */
  onCancel?: () => void;
};

/**
 * Compositor estilo Twitter em três formatos: página (/new no celular), topo do feed (desktop) e
 * janela (botão Postar da lateral). O rascunho é compartilhado entre eles.
 */
export function Composer({ variant, onPosted, onCancel }: Props) {
  const t = useTheme();
  const me = useMyAvatar();
  const contentWidth = useContentWidth();
  const { body, imageUris, location } = useDraft();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  // campo do local aberto (abaixo do texto); fechado, o local escolhido aparece como chip
  const [placeOpen, setPlaceOpen] = useState(false);
  // o que está no campo aberto: tocar Postar sem confirmar ainda leva o local
  const [placeText, setPlaceText] = useState('');
  const openPlace = () => {
    setPlaceText(location ?? '');
    setPlaceOpen(true);
  };
  const placeToPost = placeOpen ? cleanPlace(placeText) : location;
  const input = useRef<TextInput>(null);
  const grow = useAutoGrow({
    value: body,
    textStyle: t.typography.lead,
    inset: 0,
    extra: t.spacing.sm,
    min: t.typography.lead.lineHeight + t.spacing.sm,
  });

  // @: posição do cursor (null = fim do texto, logo depois de digitar) e a menção sendo escrita
  const [cursor, setCursor] = useState<number | null>(null);
  const mention = activeMention(body, Math.min(cursor ?? body.length, body.length));
  const tag = mention ? null : activeTag(body, Math.min(cursor ?? body.length, body.length));

  const room = MAX_IMAGES - imageUris.length;
  const hasDraft = body.trim().length > 0 || imageUris.length > 0;
  // local sozinho não dá post, mas é rascunho: descartar pergunta antes
  const hasAnything = hasDraft || !!location || !!placeToPost;
  // coluna de conteúdo - margens - avatar - espaço entre avatar e conteúdo
  const column = contentWidth - t.layout.gutter * 2 - t.avatarSizes.md - t.spacing.md;
  const thumb = Math.floor((column - t.spacing.sm * (MAX_IMAGES - 1)) / MAX_IMAGES);

  /** Escolhidas na galeria ou coladas (Ctrl+V): até MAX_IMAGES, avisando quando sobra. */
  const addImages = (picked: string[]) => {
    const { uris, overflow } = addPasted(imageUris, picked, MAX_IMAGES);
    if (overflow) setError(`Cabem ${MAX_IMAGES} fotos por post. Fiquei com as primeiras.`);
    setDraft((d) => ({ ...d, imageUris: uris }));
  };
  // web: Ctrl+V com imagem no campo vira foto do post
  usePasteImages(input, (uris) => {
    if (saving) return;
    setError(null);
    addImages(uris);
  });

  const pickImages = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // sem compressão aqui: a foto é reduzida uma vez só, no envio (lib/imageUpload)
        quality: 1,
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
      });
      if (!result.canceled) addImages(result.assets.map((a) => a.uri));
    } catch {
      setError('Não consegui abrir suas fotos. Confere a permissão do app e tenta de novo.');
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPost({ body, imageUris, location: placeToPost });
      emitPostCreated();
      clearDraft();
      setPlaceOpen(false);
      onPosted?.();
    } catch (e) {
      setError(friendlyError(e, 'Não rolou postar. Tenta de novo.'));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => (hasAnything ? setDiscarding(true) : onCancel?.());

  const editor = (
    <View
      style={{
        flexDirection: 'row',
        gap: t.spacing.md,
        paddingHorizontal: t.layout.gutter,
        paddingVertical: t.spacing.md,
      }}
    >
      <Avatar name={me.name} uri={me.uri} size={t.avatarSizes.md} />
      {/* a coluna inteira foca o campo, como no Twitter: tocar no vazio abre o teclado */}
      <Pressable
        onPress={() => input.current?.focus()}
        accessible={false}
        style={{
          flex: 1,
          gap: t.spacing.sm,
          minHeight: variant === 'inline' ? t.layout.minTouch : t.layout.minTouch * 3,
        }}
      >
        <View>
          {grow.mirror}
          <TextInput
            ref={input}
            numberOfLines={1}
            accessibilityLabel="O que rolou?"
            placeholder="O que rolou, fella?"
            placeholderTextColor={t.colors.textMuted}
            selectionColor={t.colors.primary}
            multiline
            maxLength={MAX_BODY}
            value={body}
            onChangeText={(text) => {
              setDraft((d) => ({ ...d, body: text }));
              setCursor(null);
            }}
            onSelectionChange={(e) => setCursor(e.nativeEvent.selection.end)}
            editable={!saving}
            textAlignVertical="top"
            style={[t.typography.lead, { color: t.colors.text, paddingTop: t.spacing.sm, height: grow.height }]}
          />
        </View>
        {mention ? (
          <MentionSuggestions
            query={mention.query}
            onPick={(username) => {
              setDraft((d) => ({ ...d, body: insertMention(d.body, mention, username) }));
              setCursor(null);
              input.current?.focus();
            }}
          />
        ) : tag ? (
          <TagSuggestions
            query={tag.query}
            onPick={(name) => {
              setDraft((d) => ({ ...d, body: insertTag(d.body, tag, name) }));
              setCursor(null);
              input.current?.focus();
            }}
          />
        ) : null}
        {!hasDraft && variant !== 'inline' ? (
          <Text variant="small" tone="muted">
            Uma frase, até {MAX_IMAGES} fotos, ou os dois. Só os fellas veem.
          </Text>
        ) : null}
        {placeOpen ? (
          <PlaceField
            initial={location ?? ''}
            disabled={saving}
            onChange={setPlaceText}
            onDone={(next) => {
              setDraft((d) => ({ ...d, location: next }));
              setPlaceOpen(false);
            }}
          />
        ) : null}
        {imageUris.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {imageUris.map((uri, i) => (
              <View key={uri} style={{ width: thumb, height: thumb }}>
                <Image
                  source={{ uri }}
                  accessibilityLabel={`Foto ${i + 1} de ${imageUris.length}`}
                  style={{ width: '100%', height: '100%', borderRadius: t.radii.md, backgroundColor: t.colors.surfaceSunken }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover foto ${i + 1}`}
                  disabled={saving}
                  onPress={() => setDraft((d) => ({ ...d, imageUris: d.imageUris.filter((_, j) => j !== i) }))}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: t.layout.minTouch,
                    height: t.layout.minTouch,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: t.layout.chipHeight,
                      height: t.layout.chipHeight,
                      borderRadius: t.radii.pill,
                      backgroundColor: t.colors.overlay,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="close" size="sm" color={t.colors.onOverlay} />
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {location && !placeOpen ? (
          <PlaceChip
            location={location}
            disabled={saving}
            onEdit={openPlace}
            onRemove={() => setDraft((d) => ({ ...d, location: null }))}
          />
        ) : null}
        {error ? (
          <Text variant="small" tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );

  const toolbar = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: variant === 'inline' ? t.spacing.xs : 0,
        borderTopWidth: variant === 'inline' ? 0 : t.borders.hairline,
        borderColor: t.colors.border,
        backgroundColor: t.colors.bg,
      }}
    >
      <IconButton
        icon="image-outline"
        accessibilityLabel={room > 0 ? 'Adicionar fotos' : `Já tem ${MAX_IMAGES} fotos`}
        variant="ghost"
        onPress={pickImages}
        disabled={room === 0 || saving}
      />
      <Text variant="small" tone="muted">
        {imageUris.length}/{MAX_IMAGES} fotos
      </Text>
      <IconButton
        icon="location-outline"
        accessibilityLabel={location ? 'Trocar local' : 'Adicionar local'}
        variant="ghost"
        onPress={openPlace}
        disabled={saving}
      />
      <View style={{ flex: 1 }} />
      {body.length >= COUNTER_FROM ? (
        <Text
          variant="small"
          tone={body.length >= MAX_BODY ? 'danger' : 'muted'}
          accessibilityLabel={`${MAX_BODY - body.length} caracteres restantes`}
          style={{ paddingHorizontal: t.spacing.sm }}
        >
          {MAX_BODY - body.length}
        </Text>
      ) : null}
      {variant === 'inline' ? (
        <Button title="Postar" loading={saving} disabled={!hasDraft} onPress={publish} />
      ) : null}
    </View>
  );

  const discardDialog = (
    <ConfirmDialog
      visible={discarding}
      title="Descartar o rascunho?"
      message="O texto e as fotos escolhidas somem."
      confirmLabel="Descartar"
      cancelLabel="Continuar escrevendo"
      onConfirm={() => {
        clearDraft();
        setPlaceOpen(false);
        setError(null);
        setDiscarding(false);
        onCancel?.();
      }}
      onClose={() => setDiscarding(false)}
    />
  );

  if (variant === 'inline') {
    return (
      <View>
        {editor}
        {toolbar}
      </View>
    );
  }

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: variant === 'dialog' ? t.spacing.sm : t.layout.gutter,
        paddingVertical: t.spacing.sm,
      }}
    >
      {variant === 'page' ? (
        <Button title="Cancelar" variant="ghost" disabled={!hasAnything || saving} onPress={cancel} />
      ) : (
        <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" onPress={cancel} disabled={saving} />
      )}
      <Button title="Postar" loading={saving} disabled={!hasDraft} onPress={publish} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: t.layout.maxContentWidth, alignSelf: 'center' }}
      >
        {editor}
      </ScrollView>
      {toolbar}
      {discardDialog}
    </KeyboardAvoidingView>
  );
}
