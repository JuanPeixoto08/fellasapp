import { View } from 'react-native';

import { useTheme } from '../../lib/theme';

export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: t.colors.border }} />;
}
