export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_accounts: {
        Row: {
          id: string;
          username: string;
          password: string;
          profile_photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password: string;
          profile_photo_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_accounts"]["Insert"]>;
        Relationships: [];
      };
      account_follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_follows"]["Insert"]>;
        Relationships: [];
      };
      app_posts: {
        Row: {
          id: string;
          account_id: string;
          type: "trip" | "experience";
          title: string;
          location: string;
          caption: string;
          image_url: string;
          latitude: number;
          longitude: number;
          date_label: string;
          visibility: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          type: "trip" | "experience";
          title: string;
          location: string;
          caption: string;
          image_url: string;
          latitude: number;
          longitude: number;
          date_label: string;
          visibility?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_posts"]["Insert"]>;
        Relationships: [];
      };
      app_boards: {
        Row: {
          id: string;
          account_id: string;
          slug: string;
          title: string;
          subtitle: string;
          cover_image_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          slug: string;
          title: string;
          subtitle?: string;
          cover_image_url?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_boards"]["Insert"]>;
        Relationships: [];
      };
      app_board_posts: {
        Row: {
          id: string;
          board_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_board_posts"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          handle: string;
          avatar_url: string;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          handle: string;
          avatar_url: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          destination: string;
          date_label: string;
          cover_image_url: string;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title: string;
          destination: string;
          date_label: string;
          cover_image_url: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [];
      };
      experiences: {
        Row: {
          id: string;
          slug: string;
          user_id: string;
          trip_id: string;
          name: string;
          location: string;
          region: string;
          latitude: number;
          longitude: number;
          caption: string;
          highlight: string | null;
          image_url: string;
          also_experienced_by: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          slug: string;
          user_id: string;
          trip_id: string;
          name: string;
          location: string;
          region: string;
          latitude: number;
          longitude: number;
          caption: string;
          highlight?: string | null;
          image_url: string;
          also_experienced_by?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["experiences"]["Insert"]>;
        Relationships: [];
      };
      friend_posts: {
        Row: {
          id: string;
          type: "trip" | "experience";
          user_id: string;
          title: string;
          destination: string;
          date_label: string;
          caption: string;
          image_url: string;
          latitude: number;
          longitude: number;
          created_at: string;
        };
        Insert: {
          id: string;
          type: "trip" | "experience";
          user_id: string;
          title: string;
          destination: string;
          date_label: string;
          caption: string;
          image_url: string;
          latitude: number;
          longitude: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["friend_posts"]["Insert"]>;
        Relationships: [];
      };
      boards: {
        Row: {
          id: string;
          slug: string;
          owner_id: string | null;
          title: string;
          subtitle: string;
          cover_image_url: string;
          created_at: string;
        };
        Insert: {
          id: string;
          slug: string;
          owner_id?: string | null;
          title: string;
          subtitle: string;
          cover_image_url: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["boards"]["Insert"]>;
        Relationships: [];
      };
      board_items: {
        Row: {
          id: string;
          board_id: string;
          experience_slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          experience_slug: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_items"]["Insert"]>;
        Relationships: [];
      };
      planned_trips: {
        Row: {
          id: string;
          user_id: string;
          destination: string;
          date_range: string;
          joined_user_ids: string[];
          extra_count: number;
          latitude: number;
          longitude: number;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          destination: string;
          date_range: string;
          joined_user_ids?: string[];
          extra_count?: number;
          latitude: number;
          longitude: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["planned_trips"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
