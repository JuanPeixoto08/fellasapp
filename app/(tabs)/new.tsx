import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Avatar, Button, ConfirmDialog, Icon, IconButton, Screen, Text, useAutoGrow } from '../../components/ui';
import { createPost, MAX_IMAGES } from '../../lib/api/posts';
import { friendlyError } from '../../lib/errors';
import { emitPostCreated } from '../../lib/postEvents';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';

/** Mesmo limite do check posts_body_check (0001). */
const MAX_BODY = 2000;
/** O contador só aparece perto do limite, para não virar ruído. */
const COUNTER_FROM = MAX_BODY - 200;

/**
 * Compositor estilo Twitter: meu avatar ao lado de um campo grande sem caixa, fotos logo abaixo,
 * barra de ferramentas embaixo (fotos + contador) e Postar no topo.
 */
export default function NewPostScreen() {
  const t = useTheme();
  const router = useRouter();
  const me = useMyAvatar();
  const { width } = useWindowDimensions();
  const [body, setBody] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const input = useRef<TextInput>(null);
  // o campo acompanha o texto (cresce e encolhe), no app e na web
  const grow = useAutoGrow({
    value: body,
    textStyle: t.typography.lead,
    inset: 0,
    extra: t.spacing.sm,
    min: t.typography.lead.lineHeight + t.spacing.sm,
  });

  const room = MAX_IMAGES - imageUris.length;
  const hasDraft = body.trim().length > 0 || imageUris.length > 0;
  // coluna de conteúdo: tela - margens - avatar - espaço entre avatar e conteúdo
  const column =
    Math.min(width, t.layout.maxContentWidth) - t.layout.gutter * 2 - t.avatarSizes.md - t.spacing.md;
  const thumb = Math.floor((column - t.spacing.sm * (MAX_IMAGES - 1)) / MAX_IMAGES);

  const clear = () => {
    setBody('');
    setImageUris([]);
    setError(null);
  };

  const pickImages = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
      });
      if (!result.canceled) {
        const picked = result.assets.map((a) => a.uri);
        if (imageUris.length + picked.length > MAX_IMAGES) {
          setError(`Cabem ${MAX_IMAGES} fotos por post. Fiquei com as primeiras.`);
        }
        setImageUris((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
      }
    } catch {
      setError('Não consegui abrir suas fotos. Confere a permissão do app e tenta de novo.');
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPost({ body, imageUris });
      emitPostCreated();
      clear();
      router.navigate('/feed');
    } catch (e) {
      setError(friendlyError(e, 'Não rolou postar. Tenta de novo.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen flush>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.layout.gutter,
            paddingVertical: t.spacing.sm,
          }}
        >
          <Button
            title="Cancelar"
            variant="ghost"
            disabled={!hasDraft || saving}
            onPress={() => setDiscarding(true)}
          />
          <Button title="Postar" loading={saving} disabled={!hasDraft} onPress={publish} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            width: '100%',
            maxWidth: t.layout.maxContentWidth,
            alignSelf: 'center',
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
            style={{ flex: 1, gap: t.spacing.sm, minHeight: t.layout.minTouch * 3 }}
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
                onChangeText={setBody}
                editable={!saving}
                textAlignVertical="top"
                style={[
                  t.typography.lead,
                  {
                    color: t.colors.text,
                    paddingTop: t.spacing.sm,
                    height: grow.height,
                  },
                ]}
              />
            </View>
            {!hasDraft ? (
              <Text variant="small" tone="muted">
                Uma frase, até {MAX_IMAGES} fotos, ou os dois. Só os fellas veem.
              </Text>
            ) : null}
            {imageUris.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                {imageUris.map((uri, i) => (
                  <View key={uri} style={{ width: thumb, height: thumb }}>
                    <Image
                      source={{ uri }}
                      accessibilityLabel={`Foto ${i + 1} de ${imageUris.length}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: t.radii.md,
                        backgroundColor: t.colors.surfaceSunken,
                      }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remover foto ${i + 1}`}
                      disabled={saving}
                      onPress={() => setImageUris((prev) => prev.filter((_, j) => j !== i))}
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
            {error ? (
              <Text variant="small" tone="danger" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </Pressable>
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.xs,
            paddingHorizontal: t.spacing.sm,
            borderTopWidth: t.borders.hairline,
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
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={discarding}
        title="Descartar o rascunho?"
        message="O texto e as fotos escolhidas somem."
        confirmLabel="Descartar"
        cancelLabel="Continuar escrevendo"
        onConfirm={() => {
          clear();
          setDiscarding(false);
          router.navigate('/feed');
        }}
        onClose={() => setDiscarding(false)}
      />
    </Screen>
  );
}
