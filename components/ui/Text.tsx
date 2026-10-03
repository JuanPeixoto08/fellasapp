import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type Colors, type TextVariant } from '../../lib/theme';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: 'default' | 'muted' | 'primary' | 'danger' | 'success' | 'onPrimary' | 'onDanger';
  bold?: boolean;
  /** Marca-texto amarelo atrás do texto (assinatura do zine). */
  highlight?: boolean;
  align?: 'left' | 'center' | 'right';
};

const toneKey: Record<NonNullable<TextProps['tone']>, keyof Colors> = {
  default: 'text',
  muted: 'textMuted',
  primary: 'primary',
  danger: 'danger',
  success: 'success',
  onPrimary: 'onPrimary',
  onDanger: 'onDanger',
};

export function Text({ variant = 'body', tone = 'default', bold, highlight, align, style, ...rest }: TextProps) {
  const t = useTheme();
  const boldBody = bold && (variant === 'body' || variant === 'small' || variant === 'lead');
  return (
    <RNText
      {...rest}
      style={[
        t.typography[variant],
        boldBody ? { fontFamily: t.fonts.bodyBold } : null,
        { color: t.colors[toneKey[tone]] },
        highlight ? { backgroundColor: t.colors.accent, color: t.colors.onAccent } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

export type HeadingProps = Omit<TextProps, 'variant'> & { level?: 1 | 2 | 3 };

const levelVariant = { 1: 'headline', 2: 'title', 3: 'lead' } as const;

export function Heading({ level = 1, style, ...rest }: HeadingProps) {
  return <Text accessibilityRole="header" bold={level === 3} {...rest} variant={levelVariant[level]} style={style} />;
}
