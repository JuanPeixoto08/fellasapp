import { Modal, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Composer } from '../feed/Composer';

type Props = { visible: boolean; onClose: () => void };

/**
 * Janela do compositor (botão Postar da lateral), por cima de qualquer tela: compacta, presa perto do topo
 * (não pula enquanto cresce) e crescendo com o texto e as fotos até `sheetHeightRatio` da tela.
 */
export function ComposeDialog({ visible, onClose }: Props) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        testID="compose-backdrop"
        style={{
          flex: 1,
          backgroundColor: t.colors.overlay,
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: t.layout.gutter,
          paddingTop: t.spacing.xxxl,
        }}
      >
        <View
          testID="compose-dialog"
          accessibilityViewIsModal
          style={[
            {
              width: '100%',
              maxWidth: t.layout.centerWidth,
              maxHeight: height * t.layout.sheetHeightRatio,
              backgroundColor: t.colors.bg,
              borderRadius: t.radii.lg,
              borderWidth: t.borders.hairline,
              borderColor: t.colors.border,
              overflow: 'hidden',
            },
            t.shadows.raised,
          ]}
        >
          {visible ? <Composer variant="dialog" onPosted={onClose} onCancel={onClose} /> : null}
        </View>
      </View>
    </Modal>
  );
}
