import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ShellContext, useContentWidth, useOpenCompose } from '../components/shell/ShellContext';

function Probe() {
  const width = useContentWidth();
  const open = useOpenCompose();
  return <Text>{`${width}|${open ? 'pode' : 'nao'}`}</Text>;
}

describe('ShellContext', () => {
  it('sem moldura: largura da janela limitada a 640, sem compositor', async () => {
    await render(<Probe />); // janela do jest: 750px
    expect(screen.getByText('640|nao')).toBeTruthy();
  });

  it('com moldura: usa a largura e o compositor dela', async () => {
    await render(
      <ShellContext.Provider value={{ contentWidth: 600, openCompose: () => {} }}>
        <Probe />
      </ShellContext.Provider>,
    );
    expect(screen.getByText('600|pode')).toBeTruthy();
  });
});
