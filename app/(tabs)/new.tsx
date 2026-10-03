import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, Image, StyleSheet, TextInput, View } from 'react-native';

import { createPost } from '../../lib/api/posts';

export default function NewPostScreen() {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const publish = async () => {
    setSaving(true);
    try {
      await createPost({ body, imageUri });
      setBody('');
      setImageUri(null);
      router.navigate('/feed');
    } catch (e) {
      Alert.alert('Erro ao publicar', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="O que está acontecendo?"
        multiline
        value={body}
        onChangeText={setBody}
      />
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
      <View style={styles.row}>
        <Button title={imageUri ? 'Trocar imagem' : 'Escolher imagem'} onPress={pickImage} />
        {imageUri ? <Button title="Remover" onPress={() => setImageUri(null)} /> : null}
      </View>
      <Button
        title={saving ? 'Publicando...' : 'Publicar'}
        onPress={publish}
        disabled={saving || (!body.trim() && !imageUri)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 8 },
  row: { flexDirection: 'row', gap: 12 },
});
