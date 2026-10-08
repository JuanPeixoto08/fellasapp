import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { gameTable, useTheme } from '../../lib/theme';

type Card = { rank: string; suit: string; red: boolean };

/** Miniatura da mesa de feltro com duas cartas: a capa de cada jogo na aba Fellas Games. */
export function TableArt({ cards, muted }: { cards: [Card, Card]; muted?: boolean }) {
  const t = useTheme();
  const { width: w, height: h, card } = t.layout.gameArt;
  const ch = card * 1.4;
  const gap = card + t.spacing.xs;
  const x0 = w / 2 - (card + gap) / 2;
  const y0 = h / 2 - ch / 2;
  return (
    // decorativa: o nome do jogo está ao lado
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: muted ? 0.45 : 1 }}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="felt" cx="50%" cy="60%" r="70%">
            <Stop offset="0" stopColor={gameTable.felt[0]} />
            <Stop offset="0.6" stopColor={gameTable.felt[1]} />
            <Stop offset="1" stopColor={gameTable.felt[2]} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} rx={t.radii.md} fill="url(#felt)" stroke={gameTable.rim} strokeWidth={3} />
        {cards.map((c, i) => (
          <SvgCard key={i} x={x0 + i * gap} y={y0} w={card} h={ch} card={c} r={t.radii.sm} />
        ))}
      </Svg>
    </View>
  );
}

function SvgCard({ x, y, w, h, card, r }: { x: number; y: number; w: number; h: number; card: Card; r: number }) {
  const color = card.red ? gameTable.cardRed : gameTable.cardInk;
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={r} fill={gameTable.card} />
      <SvgText x={x + 4} y={y + 11} fontSize={10} fontWeight="700" fill={color}>
        {card.rank}
      </SvgText>
      <SvgText x={x + w - 4} y={y + h - 5} fontSize={16} textAnchor="end" fill={color}>
        {card.suit}
      </SvgText>
    </>
  );
}
