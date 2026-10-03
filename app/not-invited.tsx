import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../lib/auth/SessionProvider';

export default function NotInvitedScreen() {
  const { signOut } = useSession();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Você ainda não foi convidado</Text>
      <Text style={styles.text}>
        Este app é só para um grupo fechado de amigos. Peça para alguém do grupo liberar o seu email.
      </Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => void signOut()}>
        <Text style={styles.buttonText}>Sair</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 15, textAlign: 'center', color: '#555' },
  button: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
