// Formato de `supabase gen types typescript`, mantido à mão. Veja supabase/README.md.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          email: string;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          email: string;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ideas: {
        Row: {
          id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      // Fellas Games (0027): o app só lê; quem escreve são as funções do banco
      game_wallets: {
        Row: {
          user_id: string;
          balance: number;
          week_start: string;
          fiado_count: number;
          last_fiado_on: string | null;
          last_played_at: string | null;
          updated_at: string;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      game_weeks: {
        Row: {
          week_start: string;
          champion_id: string | null;
          podium: Json;
          closed_at: string;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      idle_weeks: {
        Row: {
          week_start: string;
          unicorn_id: string | null;
          podium: Json;
          most_hired_id: string | null;
          closed_at: string;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      poker_tables: {
        Row: {
          id: number;
          small_blind: number;
          big_blind: number;
          min_buyin: number;
          max_buyin: number;
          seq: number;
          hand_no: number;
          last_bb_seat: number | null;
          next_hand_at: string | null;
          state: Json;
          updated_at: string;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      idea_votes: {
        Row: {
          idea_id: string;
          user_id: string;
          value: number;
          created_at: string;
        };
        Insert: {
          idea_id: string;
          user_id: string;
          value: number;
          created_at?: string;
        };
        Update: {
          idea_id?: string;
          user_id?: string;
          value?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      invite_links: {
        Row: {
          token: string;
          created_by: string | null;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_email: string | null;
        };
        Insert: {
          token: string;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_email?: string | null;
        };
        Update: {
          token?: string;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_email?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          banner_url: string | null;
          bio: string | null;
          status: string | null;
          location: string | null;
          birthday: string | null;
          is_member: boolean;
          badges: string[];
          lastfm_user: string | null;
          show_now_playing: boolean;
          hidden_badges: string[];
          featured_badge: string | null;
          letterboxd_user: string | null;
          is_admin: boolean;
          pinned_post_id: string | null;
          created_at: string;
          notifications_seen_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          status?: string | null;
          location?: string | null;
          birthday?: string | null;
          is_member?: boolean;
          badges?: string[];
          lastfm_user?: string | null;
          show_now_playing?: boolean;
          hidden_badges?: string[];
          featured_badge?: string | null;
          letterboxd_user?: string | null;
          is_admin?: boolean;
          pinned_post_id?: string | null;
          created_at?: string;
          notifications_seen_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          status?: string | null;
          location?: string | null;
          birthday?: string | null;
          is_member?: boolean;
          badges?: string[];
          lastfm_user?: string | null;
          show_now_playing?: boolean;
          hidden_badges?: string[];
          featured_badge?: string | null;
          letterboxd_user?: string | null;
          is_admin?: boolean;
          pinned_post_id?: string | null;
          created_at?: string;
          notifications_seen_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          body: string;
          image_url: string | null;
          /** Caminhos das fotos (até 4), na ordem; vazio em posts sem foto ou anteriores à 0005. */
          images: string[];
          tags: string[];
          /** Local escrito por quem postou (até 60), ou null. */
          location: string | null;
          /** Chave do local (minúsculas, sem acento); o gatilho preenche. */
          place_key: string | null;
          /** Enquete (0025): opções (2–4), fim e votos por opção (o banco mantém); null sem enquete. */
          poll_options: string[] | null;
          poll_ends_at: string | null;
          poll_counts: number[] | null;
          /** Ingresso (0026): review do Letterboxd ou música do Last.fm, congelada; ver lib/postMedia. */
          media: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          body?: string;
          image_url?: string | null;
          images?: string[];
          tags?: string[];
          location?: string | null;
          place_key?: string | null;
          poll_options?: string[] | null;
          poll_ends_at?: string | null;
          poll_counts?: number[] | null;
          media?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          body?: string;
          image_url?: string | null;
          images?: string[];
          tags?: string[];
          location?: string | null;
          place_key?: string | null;
          poll_options?: string[] | null;
          poll_ends_at?: string | null;
          poll_counts?: number[] | null;
          media?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_votes: {
        Row: {
          post_id: string;
          user_id: string;
          /** Índice da opção (0–3). Só o próprio voto é legível (anônimo). */
          option: number;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          option: number;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          option?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reactions: {
        Row: {
          post_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_reactions: {
        Row: {
          comment_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          /** Caminhos das imagens (até 4), na ordem; vazio em comentário só de texto. */
          images: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          images?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          body?: string;
          images?: string[];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stories: {
        Row: { id: string; author_id: string; kind: string; media_id: string; duration_ms: number; created_at: string; post_id: string | null };
        Insert: { id?: string; author_id: string; kind: string; media_id: string; duration_ms: number; created_at?: string; post_id?: string | null };
        Update: { id?: string; author_id?: string; kind?: string; media_id?: string; duration_ms?: number; created_at?: string; post_id?: string | null };
        Relationships: [];
      };
      story_views: {
        Row: { story_id: string; viewer_id: string; viewed_at: string };
        Insert: { story_id: string; viewer_id: string; viewed_at?: string };
        Update: { story_id?: string; viewer_id?: string; viewed_at?: string };
        Relationships: [];
      };
      story_reactions: {
        Row: { story_id: string; user_id: string; emoji: string; created_at: string };
        Insert: { story_id: string; user_id: string; emoji: string; created_at?: string };
        Update: { story_id?: string; user_id?: string; emoji?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_member: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      create_invite_link: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      redeem_invite: {
        Args: { p_token: string; p_email: string };
        Returns: undefined;
      };
      set_pinned_post: {
        Args: { p_post_id: string | null };
        Returns: undefined;
      };
      tag_suggestions: {
        Args: { p_prefix: string; p_limit?: number };
        Returns: { tag: string; posts: number }[];
      };
      place_suggestions: {
        Args: { p_prefix: string; p_limit?: number };
        Returns: { key: string; name: string; posts: number }[];
      };
      games_wallet: {
        Args: Record<string, never>;
        Returns: Json;
      };
      games_board: {
        Args: Record<string, never>;
        Returns: Json;
      };
      games_fiado: {
        Args: Record<string, never>;
        Returns: Json;
      };
      ideas_feed: {
        Args: { p_sort?: string };
        Returns: {
          id: string;
          author_id: string;
          body: string;
          created_at: string;
          score: number;
          my_vote: number | null;
        }[];
      };
      notifications_feed: {
        Args: { p_limit?: number };
        Returns: {
          kind: string;
          post_id: string | null;
          comment_id: string | null;
          story_id: string | null;
          actor_ids: string[];
          actor_count: number;
          emojis: string[];
          body: string | null;
          latest_at: string;
          unread: boolean;
        }[];
      };
      unread_notifications_count: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      mark_notifications_seen: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
