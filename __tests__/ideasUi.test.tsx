const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { IdeasButton } from '../components/ideas/IdeasButton';
import { IdeaRow } from '../components/ideas/IdeaRow';
import { VoteColumn } from '../components/ideas/VoteColumn';
import type { Idea } from '../lib/ideas';

const idea: Idea = {
  id: 'i1',
  body: 'Modo escuro automático',
  createdAt: new Date().toISOString(),
  author: { id: 'u2', name: 'Bia', avatarUrl: null },
  score: -3,
  myVote: -1,
};

describe('VoteColumn', () => {
  it('mostra a pontuação e manda a seta tocada', async () => {
    const onVote = jest.fn();
    await render(<VoteColumn score={7} myVote={1} onVote={onVote} />);
    expect(screen.getByLabelText('7 pontos, seu voto: a favor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Votar a favor' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('button', { name: 'Votar contra' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Votar contra' }));
    expect(onVote).toHaveBeenCalledWith(-1);
  });

  it('setas dizem de qual ideia são (leitor de tela)', async () => {
    await render(<VoteColumn score={1} myVote={null} onVote={() => {}} context="Modo escuro automático" />);
    expect(screen.getByRole('button', { name: 'Votar a favor' }).props.accessibilityHint).toBe(
      'Ideia: Modo escuro automático',
    );
  });

  it('sem voto e pontuação negativa', async () => {
    await render(<VoteColumn score={-3} myVote={null} onVote={() => {}} />);
    expect(screen.getByText('−3')).toBeTruthy();
    expect(screen.getByLabelText('−3 pontos')).toBeTruthy();
  });
});

describe('IdeaRow', () => {
  it('texto, autor e lixeira quando pode apagar', async () => {
    const onDelete = jest.fn();
    await render(<IdeaRow idea={idea} canDelete onVote={() => {}} onDelete={onDelete} />);
    expect(screen.getByText('Modo escuro automático')).toBeTruthy();
    expect(screen.getByText('Bia')).toBeTruthy();
    expect(screen.getByLabelText('−3 pontos, seu voto: contra')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar ideia' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('sem lixeira quando não pode apagar', async () => {
    await render(<IdeaRow idea={idea} canDelete={false} onVote={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Apagar ideia' })).toBeNull();
  });
});

describe('IdeasButton', () => {
  it('abre o mural', async () => {
    await render(<IdeasButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ideias' }));
    expect(mockPush).toHaveBeenCalledWith('/ideas');
  });
});
