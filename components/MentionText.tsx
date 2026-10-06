import { router } from 'expo-router';

import { useMembersByUsername } from '../lib/memberDirectory';
import { splitMentions } from '../lib/mentions';
import { useTheme } from '../lib/theme';
import { Text, type TextProps } from './ui';
import { profilePath } from '../lib/openProfile';

type Props = Omit<TextProps, 'children'> & {
  text: string;
  /** #tag vira link para a página da tag (só em posts). */
  tags?: boolean;
};

/** Texto de post/comentário com @usuario de fella (e, em posts, #tag) destacado em `brand` e tocável. */
export function MentionText({ text, tags = false, ...rest }: Props) {
  const t = useTheme();
  const byUsername = useMembersByUsername();
  return (
    <Text {...rest}>
      {splitMentions(text, byUsername, { tags }).map((part, i) =>
        part.member ? (
          <Text
            key={i}
            {...rest}
            bold
            accessibilityRole="link"
            accessibilityLabel={`Ver perfil de ${part.member.name}`}
            suppressHighlighting
            onPress={() => router.push(profilePath(part.member!.username))}
            style={{ color: t.colors.brand }}
          >
            {part.text}
          </Text>
        ) : part.tag ? (
          <Text
            key={i}
            {...rest}
            bold
            accessibilityRole="link"
            accessibilityLabel={`Ver posts com #${part.tag}`}
            suppressHighlighting
            onPress={() => router.push(`/tag/${encodeURIComponent(part.tag!)}`)}
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
