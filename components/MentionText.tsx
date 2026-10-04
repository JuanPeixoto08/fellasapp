import { router } from 'expo-router';

import { useMembersByUsername } from '../lib/memberDirectory';
import { splitMentions } from '../lib/mentions';
import { useTheme } from '../lib/theme';
import { Text, type TextProps } from './ui';

type Props = Omit<TextProps, 'children'> & { text: string };

/** Texto de post/comentário com @usuario de fella destacado (cor `brand`, negrito) e levando ao perfil. */
export function MentionText({ text, ...rest }: Props) {
  const t = useTheme();
  const byUsername = useMembersByUsername();
  return (
    <Text {...rest}>
      {splitMentions(text, byUsername).map((part, i) =>
        part.member ? (
          <Text
            key={i}
            {...rest}
            bold
            accessibilityRole="link"
            accessibilityLabel={`Ver perfil de ${part.member.name}`}
            suppressHighlighting
            onPress={() => router.push(`/user/${part.member!.id}`)}
            style={{ color: t.colors.brand }}
          >
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}
