import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';

import { Button, Heading, Screen, Text, TextField } from '../../components/ui';
import { createPost } from '../../lib/api/posts';
import { useTheme } from '../../lib/theme';

export default function NewPostScreen() {
  const t = useTheme();
  const router = useRouter();
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch {
      setError('Não consegui abrir suas fotos. Confere a permissão do app e tenta de novo.');
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPost({ body, imageUri });
      setBody('');
      setImageUri(null);
      router.navigate('/feed');
    } catch (e) {
      setError(
        `Não rolou postar${e instanceof Error && e.message ? ` (${e.message})` : ''}. Tenta de novo.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Heading level={1}>Solta aí</Heading>
      <TextField
        label="O que rolou?"
        placeholder="Conta pros fellas…"
        multiline
        value={body}
        onChangeText={setBody}
        editable={!saving}
        textAlignVertical="top"
      />
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          accessibilityLabel="Prévia da foto escolhida"
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: t.radii.md,
            backgroundColor: t.colors.surfaceSunken,
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
        <Button
          variant="secondary"
          title={imageUri ? 'Trocar foto' : 'Adicionar foto'}
          onPress={pickImage}
          disabled={saving}
        />
        {imageUri ? (
          <Button variant="ghost" title="Remover foto" onPress={() => setImageUri(null)} disabled={saving} />
        ) : null}
      </View>
      {error ? (
        <Text tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        title="Postar"
        fullWidth
        loading={saving}
        onPress={publish}
        disabled={!body.trim() && !imageUri}
      />
    </Screen>
  );
}
