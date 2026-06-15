export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      evidence_files: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string
          fir_id: string
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          fir_id: string
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          fir_id?: string
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_fir_id_fkey"
            columns: ["fir_id"]
            isOneToOne: false
            referencedRelation: "fir_records"
            referencedColumns: ["id"]
          },
        ]
      }
      fir_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          fir_id: string
          id: string
          llm_model: string | null
          officer_id: string
          pipeline_progress: Json | null
          processing_time_ms: number | null
          scene_manifest: Json | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          video_status: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          fir_id: string
          id?: string
          llm_model?: string | null
          officer_id: string
          pipeline_progress?: Json | null
          processing_time_ms?: number | null
          scene_manifest?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          video_status?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          fir_id?: string
          id?: string
          llm_model?: string | null
          officer_id?: string
          pipeline_progress?: Json | null
          processing_time_ms?: number | null
          scene_manifest?: Json | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          video_status?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fir_jobs_fir_id_fkey"
            columns: ["fir_id"]
            isOneToOne: false
            referencedRelation: "fir_records"
            referencedColumns: ["id"]
          },
        ]
      }
      fir_records: {
        Row: {
          area: string | null
          case_number: string
          city: string | null
          created_at: string
          district: string
          formatted_address: string | null
          id: string
          incident_date: string | null
          incident_type: Database["public"]["Enums"]["incident_type"]
          latitude: number | null
          longitude: number | null
          officer_id: string
          raw_narrative: string
        }
        Insert: {
          area?: string | null
          case_number?: string
          city?: string | null
          created_at?: string
          district: string
          formatted_address?: string | null
          id?: string
          incident_date?: string | null
          incident_type?: Database["public"]["Enums"]["incident_type"]
          latitude?: number | null
          longitude?: number | null
          officer_id: string
          raw_narrative: string
        }
        Update: {
          area?: string | null
          case_number?: string
          city?: string | null
          created_at?: string
          district?: string
          formatted_address?: string | null
          id?: string
          incident_date?: string | null
          incident_type?: Database["public"]["Enums"]["incident_type"]
          latitude?: number | null
          longitude?: number | null
          officer_id?: string
          raw_narrative?: string
        }
        Relationships: []
      }
      officer_profiles: {
        Row: {
          badge_number: string
          created_at: string
          district: string
          full_name: string
          id: string
          rank: string | null
          station: string | null
          updated_at: string
        }
        Insert: {
          badge_number: string
          created_at?: string
          district: string
          full_name: string
          id: string
          rank?: string | null
          station?: string | null
          updated_at?: string
        }
        Update: {
          badge_number?: string
          created_at?: string
          district?: string
          full_name?: string
          id?: string
          rank?: string | null
          station?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          latency_ms: number
          model: string
          officer_id: string
          ok: boolean
          stage: string
          status_code: number | null
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          latency_ms?: number
          model: string
          officer_id: string
          ok: boolean
          stage: string
          status_code?: number | null
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          latency_ms?: number
          model?: string
          officer_id?: string
          ok?: boolean
          stage?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "fir_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_entities: {
        Row: {
          color: string | null
          confidence: number | null
          created_at: string
          description: string | null
          entity_role: Database["public"]["Enums"]["entity_role"] | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          job_id: string
          label: string
          metadata: Json | null
          position_x: number | null
          position_y: number | null
          position_z: number | null
          source_text: string | null
        }
        Insert: {
          color?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          entity_role?: Database["public"]["Enums"]["entity_role"] | null
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          job_id: string
          label: string
          metadata?: Json | null
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          source_text?: string | null
        }
        Update: {
          color?: string | null
          confidence?: number | null
          created_at?: string
          description?: string | null
          entity_role?: Database["public"]["Enums"]["entity_role"] | null
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          job_id?: string
          label?: string
          metadata?: Json | null
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          source_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scene_entities_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "fir_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scene_events: {
        Row: {
          action_label: string
          created_at: string
          description: string
          dest_x: number | null
          dest_y: number | null
          dest_z: number | null
          duration_seconds: number | null
          entity_id: string | null
          id: string
          job_id: string
          origin_x: number | null
          origin_y: number | null
          origin_z: number | null
          sequence_number: number
          source_text: string | null
        }
        Insert: {
          action_label: string
          created_at?: string
          description: string
          dest_x?: number | null
          dest_y?: number | null
          dest_z?: number | null
          duration_seconds?: number | null
          entity_id?: string | null
          id?: string
          job_id: string
          origin_x?: number | null
          origin_y?: number | null
          origin_z?: number | null
          sequence_number: number
          source_text?: string | null
        }
        Update: {
          action_label?: string
          created_at?: string
          description?: string
          dest_x?: number | null
          dest_y?: number | null
          dest_z?: number | null
          duration_seconds?: number | null
          entity_id?: string | null
          id?: string
          job_id?: string
          origin_x?: number | null
          origin_y?: number | null
          origin_z?: number | null
          sequence_number?: number
          source_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scene_events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "scene_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scene_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "fir_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_case_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "superadmin"
      entity_role: "suspect" | "victim" | "witness" | "bystander"
      entity_type: "actor" | "vehicle" | "location" | "object"
      incident_type:
        | "theft"
        | "assault"
        | "vehicular"
        | "property"
        | "kidnapping"
        | "robbery"
        | "other"
      job_status:
        | "pending"
        | "preprocessing"
        | "entity_extraction"
        | "spatial_resolution"
        | "timeline_sequencing"
        | "scene_generation"
        | "completed"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["superadmin"],
      entity_role: ["suspect", "victim", "witness", "bystander"],
      entity_type: ["actor", "vehicle", "location", "object"],
      incident_type: [
        "theft",
        "assault",
        "vehicular",
        "property",
        "kidnapping",
        "robbery",
        "other",
      ],
      job_status: [
        "pending",
        "preprocessing",
        "entity_extraction",
        "spatial_resolution",
        "timeline_sequencing",
        "scene_generation",
        "completed",
        "failed",
      ],
    },
  },
} as const
