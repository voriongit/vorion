export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bots: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          system_prompt: string
          model: string
          temperature: number
          max_tokens: number
          avatar_url: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          system_prompt: string
          model?: string
          temperature?: number
          max_tokens?: number
          avatar_url?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          system_prompt?: string
          model?: string
          temperature?: number
          max_tokens?: number
          avatar_url?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      team_bots: {
        Row: {
          id: string
          team_id: string
          bot_id: string
          role: string | null
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          bot_id: string
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          bot_id?: string
          role?: string | null
          created_at?: string
        }
      }
      mcp_servers: {
        Row: {
          id: string
          user_id: string
          name: string
          type: string
          config: Json
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: string
          config: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: string
          config?: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      bot_mcp_servers: {
        Row: {
          id: string
          bot_id: string
          mcp_server_id: string
          permissions: Json
          created_at: string
        }
        Insert: {
          id?: string
          bot_id: string
          mcp_server_id: string
          permissions?: Json
          created_at?: string
        }
        Update: {
          id?: string
          bot_id?: string
          mcp_server_id?: string
          permissions?: Json
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          bot_id: string | null
          team_id: string | null
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bot_id?: string | null
          team_id?: string | null
          title: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bot_id?: string | null
          team_id?: string | null
          title?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          bot_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          bot_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          bot_id?: string | null
          created_at?: string
        }
      }
      // Allow any other tables (types not yet generated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
