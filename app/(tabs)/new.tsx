import { useRouter } from 'expo-router';

import { Composer } from '../../components/feed/Composer';
import { Screen } from '../../components/ui';

/** Novo post no celular: o compositor em página inteira. */
export default function NewPostScreen() {
  const router = useRouter();
  const toFeed = () => router.navigate('/feed');
  return (
    <Screen flush>
      <Composer variant="page" onPosted={toFeed} onCancel={toFeed} />
    </Screen>
  );
}
