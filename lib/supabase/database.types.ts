export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          commercial_fit: Json
          created_at: string
          decision: Database["public"]["Enums"]["assessment_decision"]
          delivery_route: Database["public"]["Enums"]["delivery_route"] | null
          dimension_results: Json
          evidence_snapshot: Json
          execution_metadata: Json
          id: string
          opportunity_id: string
          overall_confidence: number
          overall_score: number
          profile_version: string
          rejection_reason: Json | null
          score_policy_id: string
          workspace_id: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          assessment_type: Database["public"]["Enums"]["assessment_type"]
          commercial_fit?: Json
          created_at?: string
          decision: Database["public"]["Enums"]["assessment_decision"]
          delivery_route?: Database["public"]["Enums"]["delivery_route"] | null
          dimension_results?: Json
          evidence_snapshot?: Json
          execution_metadata?: Json
          id?: string
          opportunity_id: string
          overall_confidence: number
          overall_score: number
          profile_version: string
          rejection_reason?: Json | null
          score_policy_id: string
          workspace_id: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          assessment_type?: Database["public"]["Enums"]["assessment_type"]
          commercial_fit?: Json
          created_at?: string
          decision?: Database["public"]["Enums"]["assessment_decision"]
          delivery_route?: Database["public"]["Enums"]["delivery_route"] | null
          dimension_results?: Json
          evidence_snapshot?: Json
          execution_metadata?: Json
          id?: string
          opportunity_id?: string
          overall_confidence?: number
          overall_score?: number
          profile_version?: string
          rejection_reason?: Json | null
          score_policy_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_score_policy_id_fkey"
            columns: ["score_policy_id"]
            isOneToOne: false
            referencedRelation: "score_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "assessments_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      automation_exceptions: {
        Row: {
          created_at: string
          details: Json
          exception_kind: string
          id: string
          opportunity_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_id: string | null
          status: string
          summary: string
          workflow_run_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          exception_kind: string
          id?: string
          opportunity_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          status?: string
          summary: string
          workflow_run_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          exception_kind?: string
          id?: string
          opportunity_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          status?: string
          summary?: string
          workflow_run_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_exceptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_exceptions_workspace_id_opportunity_id_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "automation_exceptions_workspace_id_opportunity_id_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "automation_exceptions_workspace_id_source_id_fkey"
            columns: ["workspace_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "automation_exceptions_workspace_id_workflow_run_id_fkey"
            columns: ["workspace_id", "workflow_run_id"]
            isOneToOne: false
            referencedRelation: "automation_workflow_runs"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      automation_stage_runs: {
        Row: {
          attempt: number
          available_at: string
          created_at: string
          error_code: string | null
          estimated_cost: number
          failure_reason: string | null
          finished_at: string | null
          id: string
          input_snapshot: Json
          lease_token: string | null
          leased_by: string | null
          leased_until: string | null
          output_snapshot: Json
          pass: number
          stage: Database["public"]["Enums"]["automation_stage"]
          started_at: string | null
          status: Database["public"]["Enums"]["automation_stage_status"]
          stop_reason: string | null
          usage: Json
          workflow_run_id: string
          workspace_id: string
        }
        Insert: {
          attempt?: number
          available_at?: string
          created_at?: string
          error_code?: string | null
          estimated_cost?: number
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          input_snapshot?: Json
          lease_token?: string | null
          leased_by?: string | null
          leased_until?: string | null
          output_snapshot?: Json
          pass?: number
          stage: Database["public"]["Enums"]["automation_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_stage_status"]
          stop_reason?: string | null
          usage?: Json
          workflow_run_id: string
          workspace_id: string
        }
        Update: {
          attempt?: number
          available_at?: string
          created_at?: string
          error_code?: string | null
          estimated_cost?: number
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          input_snapshot?: Json
          lease_token?: string | null
          leased_by?: string | null
          leased_until?: string | null
          output_snapshot?: Json
          pass?: number
          stage?: Database["public"]["Enums"]["automation_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_stage_status"]
          stop_reason?: string | null
          usage?: Json
          workflow_run_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_stage_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_stage_runs_workspace_id_workflow_run_id_fkey"
            columns: ["workspace_id", "workflow_run_id"]
            isOneToOne: false
            referencedRelation: "automation_workflow_runs"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      automation_workflow_runs: {
        Row: {
          cost_currency: string
          cost_limit: number
          coverage_profile_id: string
          created_at: string
          current_stage: Database["public"]["Enums"]["automation_stage"]
          error_code: string | null
          estimated_cost: number
          failure_reason: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["automation_workflow_kind"]
          opportunity_id: string | null
          search_plan_snapshot: Json
          source_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["automation_workflow_status"]
          stop_reason: string | null
          trigger_kind: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cost_currency?: string
          cost_limit?: number
          coverage_profile_id: string
          created_at?: string
          current_stage: Database["public"]["Enums"]["automation_stage"]
          error_code?: string | null
          estimated_cost?: number
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["automation_workflow_kind"]
          opportunity_id?: string | null
          search_plan_snapshot?: Json
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_workflow_status"]
          stop_reason?: string | null
          trigger_kind: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cost_currency?: string
          cost_limit?: number
          coverage_profile_id?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["automation_stage"]
          error_code?: string | null
          estimated_cost?: number
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["automation_workflow_kind"]
          opportunity_id?: string | null
          search_plan_snapshot?: Json
          source_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_workflow_status"]
          stop_reason?: string | null
          trigger_kind?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflow_runs_workspace_id_coverage_profile_id_fkey"
            columns: ["workspace_id", "coverage_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_coverage_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "automation_workflow_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_workflow_runs_workspace_id_opportunity_id_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "automation_workflow_runs_workspace_id_opportunity_id_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "automation_workflow_runs_workspace_id_source_id_fkey"
            columns: ["workspace_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      coverage_profile_source_packs: {
        Row: {
          configuration_overrides: Json
          coverage_profile_id: string
          created_at: string
          linked_by: string | null
          source_pack_id: string
          workspace_id: string
        }
        Insert: {
          configuration_overrides?: Json
          coverage_profile_id: string
          created_at?: string
          linked_by?: string | null
          source_pack_id: string
          workspace_id: string
        }
        Update: {
          configuration_overrides?: Json
          coverage_profile_id?: string
          created_at?: string
          linked_by?: string | null
          source_pack_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_profile_source_packs_workspace_id_coverage_profil_fkey"
            columns: ["workspace_id", "coverage_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_coverage_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "coverage_profile_source_packs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_profile_source_packs_workspace_id_source_pack_id_fkey"
            columns: ["workspace_id", "source_pack_id"]
            isOneToOne: false
            referencedRelation: "discovery_source_packs"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      coverage_profile_sources: {
        Row: {
          coverage_profile_id: string
          created_at: string
          link_rationale: string | null
          linked_by: string | null
          signal_areas: Database["public"]["Enums"]["discovery_signal_area"][]
          source_candidate_id: string | null
          source_id: string
          workspace_id: string
        }
        Insert: {
          coverage_profile_id: string
          created_at?: string
          link_rationale?: string | null
          linked_by?: string | null
          signal_areas: Database["public"]["Enums"]["discovery_signal_area"][]
          source_candidate_id?: string | null
          source_id: string
          workspace_id: string
        }
        Update: {
          coverage_profile_id?: string
          created_at?: string
          link_rationale?: string | null
          linked_by?: string | null
          signal_areas?: Database["public"]["Enums"]["discovery_signal_area"][]
          source_candidate_id?: string | null
          source_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_profile_sources_workspace_id_coverage_profile_id__fkey"
            columns: [
              "workspace_id",
              "coverage_profile_id",
              "source_candidate_id",
            ]
            isOneToOne: false
            referencedRelation: "discovery_source_candidates"
            referencedColumns: ["workspace_id", "coverage_profile_id", "id"]
          },
          {
            foreignKeyName: "coverage_profile_sources_workspace_id_coverage_profile_id_fkey"
            columns: ["workspace_id", "coverage_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_coverage_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "coverage_profile_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_profile_sources_workspace_id_source_id_fkey"
            columns: ["workspace_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      discovery_coverage_profiles: {
        Row: {
          activated_at: string | null
          allow_source_proposals: boolean
          automation_enabled: boolean
          cadence: string
          change_note: string | null
          changed_by: string | null
          cost_limit: number
          created_at: string
          created_by: string | null
          daily_cost_limit: number
          description: string | null
          effective_at: string
          evidence_preferences: Json
          id: string
          impact_themes: string[]
          is_default: boolean
          keywords: string[]
          languages: string[]
          large_project_review_eur: number
          last_scouted_at: string | null
          lookback: string
          minimum_project_budget_eur: number
          monitor_hour: number
          name: string
          negative_terms: string[]
          next_scout_at: string | null
          notification_preferences: Json
          organization_targets: string[]
          organization_types: string[]
          preferred_budget_max_eur: number
          preferred_budget_min_eur: number
          profile_key: string
          project_clues: string[]
          project_types: string[]
          regions: string[]
          result_limit: number
          scout_interval: string
          sectors: string[]
          signal_areas: Database["public"]["Enums"]["discovery_signal_area"][]
          status: Database["public"]["Enums"]["coverage_profile_status"]
          technical_themes: string[]
          timezone: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          activated_at?: string | null
          allow_source_proposals?: boolean
          automation_enabled?: boolean
          cadence?: string
          change_note?: string | null
          changed_by?: string | null
          cost_limit?: number
          created_at?: string
          created_by?: string | null
          daily_cost_limit?: number
          description?: string | null
          effective_at?: string
          evidence_preferences?: Json
          id?: string
          impact_themes?: string[]
          is_default?: boolean
          keywords?: string[]
          languages?: string[]
          large_project_review_eur?: number
          last_scouted_at?: string | null
          lookback?: string
          minimum_project_budget_eur?: number
          monitor_hour?: number
          name: string
          negative_terms?: string[]
          next_scout_at?: string | null
          notification_preferences?: Json
          organization_targets?: string[]
          organization_types?: string[]
          preferred_budget_max_eur?: number
          preferred_budget_min_eur?: number
          profile_key: string
          project_clues?: string[]
          project_types?: string[]
          regions?: string[]
          result_limit?: number
          scout_interval?: string
          sectors?: string[]
          signal_areas: Database["public"]["Enums"]["discovery_signal_area"][]
          status?: Database["public"]["Enums"]["coverage_profile_status"]
          technical_themes?: string[]
          timezone?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          activated_at?: string | null
          allow_source_proposals?: boolean
          automation_enabled?: boolean
          cadence?: string
          change_note?: string | null
          changed_by?: string | null
          cost_limit?: number
          created_at?: string
          created_by?: string | null
          daily_cost_limit?: number
          description?: string | null
          effective_at?: string
          evidence_preferences?: Json
          id?: string
          impact_themes?: string[]
          is_default?: boolean
          keywords?: string[]
          languages?: string[]
          large_project_review_eur?: number
          last_scouted_at?: string | null
          lookback?: string
          minimum_project_budget_eur?: number
          monitor_hour?: number
          name?: string
          negative_terms?: string[]
          next_scout_at?: string | null
          notification_preferences?: Json
          organization_targets?: string[]
          organization_types?: string[]
          preferred_budget_max_eur?: number
          preferred_budget_min_eur?: number
          profile_key?: string
          project_clues?: string[]
          project_types?: string[]
          regions?: string[]
          result_limit?: number
          scout_interval?: string
          sectors?: string[]
          signal_areas?: Database["public"]["Enums"]["discovery_signal_area"][]
          status?: Database["public"]["Enums"]["coverage_profile_status"]
          technical_themes?: string[]
          timezone?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_coverage_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_jobs: {
        Row: {
          archived_at: string | null
          cadence: string
          changed_by: string | null
          checkpoint: Json
          coverage_profile_id: string
          created_at: string
          created_by: string | null
          enabled: boolean
          estimated_cost_limit: number
          id: string
          job_key: string
          last_run_at: string | null
          max_output_tokens: number
          max_turns: number
          model: string
          name: string
          next_run_at: string | null
          prompt_version: string
          result_limit: number
          search_plan_template: Json
          source_id: string
          timeout_seconds: number
          timezone: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          cadence?: string
          changed_by?: string | null
          checkpoint?: Json
          coverage_profile_id: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          estimated_cost_limit?: number
          id?: string
          job_key: string
          last_run_at?: string | null
          max_output_tokens?: number
          max_turns?: number
          model?: string
          name: string
          next_run_at?: string | null
          prompt_version?: string
          result_limit?: number
          search_plan_template?: Json
          source_id: string
          timeout_seconds?: number
          timezone?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          cadence?: string
          changed_by?: string | null
          checkpoint?: Json
          coverage_profile_id?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          estimated_cost_limit?: number
          id?: string
          job_key?: string
          last_run_at?: string | null
          max_output_tokens?: number
          max_turns?: number
          model?: string
          name?: string
          next_run_at?: string | null
          prompt_version?: string
          result_limit?: number
          search_plan_template?: Json
          source_id?: string
          timeout_seconds?: number
          timezone?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_jobs_workspace_id_coverage_profile_id_fkey"
            columns: ["workspace_id", "coverage_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_coverage_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_jobs_workspace_id_source_id_fkey"
            columns: ["workspace_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      discovery_run_results: {
        Row: {
          canonical_url: string | null
          confidence: number
          content_fingerprint: string | null
          created_at: string
          evidence_excerpt: string
          id: string
          opportunity_id: string | null
          opportunity_key: string | null
          ordinal: number
          organization_name: string
          publication_date: string | null
          publisher: string | null
          rejection_reasons: string[]
          run_id: string
          signal_id: string | null
          signal_type: string
          status: Database["public"]["Enums"]["discovery_result_status"]
          structured_output: Json
          title: string
          workspace_id: string
        }
        Insert: {
          canonical_url?: string | null
          confidence: number
          content_fingerprint?: string | null
          created_at?: string
          evidence_excerpt: string
          id?: string
          opportunity_id?: string | null
          opportunity_key?: string | null
          ordinal: number
          organization_name: string
          publication_date?: string | null
          publisher?: string | null
          rejection_reasons?: string[]
          run_id: string
          signal_id?: string | null
          signal_type: string
          status: Database["public"]["Enums"]["discovery_result_status"]
          structured_output: Json
          title: string
          workspace_id: string
        }
        Update: {
          canonical_url?: string | null
          confidence?: number
          content_fingerprint?: string | null
          created_at?: string
          evidence_excerpt?: string
          id?: string
          opportunity_id?: string | null
          opportunity_key?: string | null
          ordinal?: number
          organization_name?: string
          publication_date?: string | null
          publisher?: string | null
          rejection_reasons?: string[]
          run_id?: string
          signal_id?: string | null
          signal_type?: string
          status?: Database["public"]["Enums"]["discovery_result_status"]
          structured_output?: Json
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_run_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_run_results_workspace_id_opportunity_id_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_run_results_workspace_id_opportunity_id_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_run_results_workspace_id_run_id_fkey"
            columns: ["workspace_id", "run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_run_results_workspace_id_signal_id_fkey"
            columns: ["workspace_id", "signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          accepted_count: number
          candidate_count: number
          consulted_urls: Json
          cost_currency: string
          cost_overrun: boolean
          coverage_profile_id: string
          created_at: string
          duplicate_count: number
          duration_ms: number | null
          error_code: string | null
          estimated_cost: number
          failure_reason: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          input_tokens: number
          job_id: string
          job_version: number
          limits: Json
          model: string
          opportunities_created: number
          opportunities_matched: number
          output_tokens: number
          profile_version: number
          prompt_version: string
          rejected_count: number
          search_queries: Json
          source_id: string
          source_version: number
          started_at: string | null
          status: Database["public"]["Enums"]["discovery_run_status"]
          stop_reason: string | null
          total_tokens: number
          triggered_by: string
          validation_errors: Json
          workspace_id: string
        }
        Insert: {
          accepted_count?: number
          candidate_count?: number
          consulted_urls?: Json
          cost_currency?: string
          cost_overrun?: boolean
          coverage_profile_id: string
          created_at?: string
          duplicate_count?: number
          duration_ms?: number | null
          error_code?: string | null
          estimated_cost?: number
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          input_tokens?: number
          job_id: string
          job_version: number
          limits?: Json
          model: string
          opportunities_created?: number
          opportunities_matched?: number
          output_tokens?: number
          profile_version: number
          prompt_version: string
          rejected_count?: number
          search_queries?: Json
          source_id: string
          source_version: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["discovery_run_status"]
          stop_reason?: string | null
          total_tokens?: number
          triggered_by: string
          validation_errors?: Json
          workspace_id: string
        }
        Update: {
          accepted_count?: number
          candidate_count?: number
          consulted_urls?: Json
          cost_currency?: string
          cost_overrun?: boolean
          coverage_profile_id?: string
          created_at?: string
          duplicate_count?: number
          duration_ms?: number | null
          error_code?: string | null
          estimated_cost?: number
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          input_tokens?: number
          job_id?: string
          job_version?: number
          limits?: Json
          model?: string
          opportunities_created?: number
          opportunities_matched?: number
          output_tokens?: number
          profile_version?: number
          prompt_version?: string
          rejected_count?: number
          search_queries?: Json
          source_id?: string
          source_version?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["discovery_run_status"]
          stop_reason?: string | null
          total_tokens?: number
          triggered_by?: string
          validation_errors?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_workspace_id_coverage_profile_id_fkey"
            columns: ["workspace_id", "coverage_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_coverage_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_runs_workspace_id_job_id_fkey"
            columns: ["workspace_id", "job_id"]
            isOneToOne: false
            referencedRelation: "discovery_jobs"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_runs_workspace_id_source_id_fkey"
            columns: ["workspace_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      discovery_source_candidates: {
        Row: {
          base_url: string
          confidence: number
          cost_currency: string
          coverage_profile_id: string
          coverage_rationale: string
          created_at: string
          created_by: string | null
          estimated_monthly_cost: number
          execution_metadata: Json
          governance_questions: Json
          id: string
          jurisdiction: string | null
          name: string
          observed_update_frequency: string | null
          origin: Database["public"]["Enums"]["source_candidate_origin"]
          policy_checks: Json
          proposed_config: Json
          public_access: boolean
          reputation_evidence: Json
          reputation_score: number | null
          resolved_source_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sample_evidence: Json
          source_classification: string | null
          source_family: string
          source_pack_id: string | null
          status: Database["public"]["Enums"]["source_candidate_status"]
          suppression_fingerprint: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          base_url: string
          confidence: number
          cost_currency?: string
          coverage_profile_id: string
          coverage_rationale: string
          created_at?: string
          created_by?: string | null
          estimated_monthly_cost?: number
          execution_metadata?: Json
          governance_questions?: Json
          id?: string
          jurisdiction?: string | null
          name: string
          observed_update_frequency?: string | null
          origin: Database["public"]["Enums"]["source_candidate_origin"]
          policy_checks?: Json
          proposed_config?: Json
          public_access?: boolean
          reputation_evidence?: Json
          reputation_score?: number | null
          resolved_source_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_evidence?: Json
          source_classification?: string | null
          source_family: string
          source_pack_id?: string | null
          status?: Database["public"]["Enums"]["source_candidate_status"]
          suppression_fingerprint?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          base_url?: string
          confidence?: number
          cost_currency?: string
          coverage_profile_id?: string
          coverage_rationale?: string
          created_at?: string
          created_by?: string | null
          estimated_monthly_cost?: number
          execution_metadata?: Json
          governance_questions?: Json
          id?: string
          jurisdiction?: string | null
          name?: string
          observed_update_frequency?: string | null
          origin?: Database["public"]["Enums"]["source_candidate_origin"]
          policy_checks?: Json
          proposed_config?: Json
          public_access?: boolean
          reputation_evidence?: Json
          reputation_score?: number | null
          resolved_source_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_evidence?: Json
          source_classification?: string | null
          source_family?: string
          source_pack_id?: string | null
          status?: Database["public"]["Enums"]["source_candidate_status"]
          suppression_fingerprint?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_source_candidates_workspace_id_coverage_profile__fkey"
            columns: ["workspace_id", "coverage_profile_id"]
            isOneToOne: false
            referencedRelation: "discovery_coverage_profiles"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_source_candidates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_source_candidates_workspace_id_resolved_source_i_fkey"
            columns: ["workspace_id", "resolved_source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "discovery_source_candidates_workspace_id_source_pack_id_fkey"
            columns: ["workspace_id", "source_pack_id"]
            isOneToOne: false
            referencedRelation: "discovery_source_packs"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      discovery_source_packs: {
        Row: {
          change_note: string | null
          changed_by: string | null
          created_at: string
          created_by: string | null
          criteria_defaults: Json
          description: string | null
          effective_at: string
          id: string
          name: string
          pack_key: string
          signal_areas: Database["public"]["Enums"]["discovery_signal_area"][]
          status: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          criteria_defaults?: Json
          description?: string | null
          effective_at?: string
          id?: string
          name: string
          pack_key: string
          signal_areas: Database["public"]["Enums"]["discovery_signal_area"][]
          status?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          created_by?: string | null
          criteria_defaults?: Json
          description?: string | null
          effective_at?: string
          id?: string
          name?: string
          pack_key?: string
          signal_areas?: Database["public"]["Enums"]["discovery_signal_area"][]
          status?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_source_packs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          delivery_metadata: Json | null
          final_assessment_id: string
          id: string
          opportunity_id: string
          primary_contact_id: string | null
          review_record: Json | null
          route: Database["public"]["Enums"]["lead_route"]
          status: Database["public"]["Enums"]["lead_status"]
          suggested_next_action: string
          updated_at: string
          version: number
          why_now: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delivery_metadata?: Json | null
          final_assessment_id: string
          id?: string
          opportunity_id: string
          primary_contact_id?: string | null
          review_record?: Json | null
          route: Database["public"]["Enums"]["lead_route"]
          status?: Database["public"]["Enums"]["lead_status"]
          suggested_next_action: string
          updated_at?: string
          version?: number
          why_now: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          delivery_metadata?: Json | null
          final_assessment_id?: string
          id?: string
          opportunity_id?: string
          primary_contact_id?: string | null
          review_record?: Json | null
          route?: Database["public"]["Enums"]["lead_route"]
          status?: Database["public"]["Enums"]["lead_status"]
          suggested_next_action?: string
          updated_at?: string
          version?: number
          why_now?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_workspace_assessment_fkey"
            columns: ["workspace_id", "final_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "leads_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      opportunities: {
        Row: {
          budget: Json | null
          created_at: string
          description: string
          discovery_key: string | null
          id: string
          lifecycle_status: Database["public"]["Enums"]["lifecycle_status"]
          maturity_stage: Database["public"]["Enums"]["maturity_stage"]
          missing_fields: string[]
          organization_id: string
          resolution_metadata: Json
          technical_scope: Json | null
          timeline: Json | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          budget?: Json | null
          created_at?: string
          description: string
          discovery_key?: string | null
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          maturity_stage?: Database["public"]["Enums"]["maturity_stage"]
          missing_fields?: string[]
          organization_id: string
          resolution_metadata?: Json
          technical_scope?: Json | null
          timeline?: Json | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          budget?: Json | null
          created_at?: string
          description?: string
          discovery_key?: string | null
          id?: string
          lifecycle_status?: Database["public"]["Enums"]["lifecycle_status"]
          maturity_stage?: Database["public"]["Enums"]["maturity_stage"]
          missing_fields?: string[]
          organization_id?: string
          resolution_metadata?: Json
          technical_scope?: Json | null
          timeline?: Json | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_workspace_organization_fkey"
            columns: ["workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      opportunity_signals: {
        Row: {
          created_at: string
          link_reason: string | null
          linked_by: string | null
          opportunity_id: string
          signal_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          link_reason?: string | null
          linked_by?: string | null
          opportunity_id: string
          signal_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          link_reason?: string | null
          linked_by?: string | null
          opportunity_id?: string
          signal_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_signals_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunity_signals_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "opportunity_signals_workspace_signal_fkey"
            columns: ["workspace_id", "signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      organizations: {
        Row: {
          country_code: string | null
          created_at: string
          domain: string | null
          id: string
          metadata: Json
          name: string
          normalized_name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          metadata?: Json
          name: string
          normalized_name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          metadata?: Json
          name?: string
          normalized_name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      research_findings: {
        Row: {
          attempt_summary: Json
          confidence: number
          created_at: string
          explanation: string
          field: string
          id: string
          opportunity_id: string
          question_id: string
          source_refs: Json
          status: Database["public"]["Enums"]["finding_status"]
          value: Json | null
          workspace_id: string
        }
        Insert: {
          attempt_summary?: Json
          confidence: number
          created_at?: string
          explanation: string
          field: string
          id?: string
          opportunity_id: string
          question_id: string
          source_refs?: Json
          status: Database["public"]["Enums"]["finding_status"]
          value?: Json | null
          workspace_id: string
        }
        Update: {
          attempt_summary?: Json
          confidence?: number
          created_at?: string
          explanation?: string
          field?: string
          id?: string
          opportunity_id?: string
          question_id?: string
          source_refs?: Json
          status?: Database["public"]["Enums"]["finding_status"]
          value?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_findings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_findings_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "research_findings_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "research_findings_workspace_question_fkey"
            columns: ["workspace_id", "question_id"]
            isOneToOne: false
            referencedRelation: "research_questions"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      research_questions: {
        Row: {
          created_at: string
          decision_impact: string
          field: string
          id: string
          opportunity_id: string
          priority: number
          question: string
          status: string
          stop_rule: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          decision_impact: string
          field: string
          id?: string
          opportunity_id: string
          priority?: number
          question: string
          status?: string
          stop_rule?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          decision_impact?: string
          field?: string
          id?: string
          opportunity_id?: string
          priority?: number
          question?: string
          status?: string
          stop_rule?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_questions_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "research_questions_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      review_events: {
        Row: {
          changes: Json
          created_at: string
          decision: string
          id: string
          idempotency_key: string
          lead_id: string | null
          notes: string | null
          opportunity_id: string | null
          reason_code: string | null
          reviewer_id: string
          workspace_id: string
        }
        Insert: {
          changes?: Json
          created_at?: string
          decision: string
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          reason_code?: string | null
          reviewer_id: string
          workspace_id: string
        }
        Update: {
          changes?: Json
          created_at?: string
          decision?: string
          id?: string
          idempotency_key?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          reason_code?: string | null
          reviewer_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_workspace_lead_fkey"
            columns: ["workspace_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "review_events_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "review_events_workspace_opportunity_fkey"
            columns: ["workspace_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_dashboard"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      score_policies: {
        Row: {
          created_at: string
          created_by: string | null
          effective_at: string | null
          hard_rules: Json
          id: string
          scale_max: number
          scale_min: number
          status: string
          thresholds: Json
          tie_breakers: Json
          version: string
          weights: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_at?: string | null
          hard_rules?: Json
          id?: string
          scale_max?: number
          scale_min?: number
          status?: string
          thresholds: Json
          tie_breakers?: Json
          version: string
          weights: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_at?: string | null
          hard_rules?: Json
          id?: string
          scale_max?: number
          scale_min?: number
          status?: string
          thresholds?: Json
          tie_breakers?: Json
          version?: string
          weights?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          canonical_url: string
          captured_at: string
          content_fingerprint: string
          created_at: string
          extracted_facts: Json
          extracted_inferences: Json | null
          id: string
          organization_mentions: Json
          processing_metadata: Json
          published_at: string | null
          publisher: string | null
          raw_text: string
          revision: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_id: string
          source_item_id: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          canonical_url: string
          captured_at?: string
          content_fingerprint: string
          created_at?: string
          extracted_facts?: Json
          extracted_inferences?: Json | null
          id?: string
          organization_mentions?: Json
          processing_metadata?: Json
          published_at?: string | null
          publisher?: string | null
          raw_text: string
          revision?: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_id: string
          source_item_id?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          canonical_url?: string
          captured_at?: string
          content_fingerprint?: string
          created_at?: string
          extracted_facts?: Json
          extracted_inferences?: Json | null
          id?: string
          organization_mentions?: Json
          processing_metadata?: Json
          published_at?: string | null
          publisher?: string | null
          raw_text?: string
          revision?: number
          signal_type?: Database["public"]["Enums"]["signal_type"]
          source_id?: string
          source_item_id?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_workspace_source_fkey"
            columns: ["workspace_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      source_health_events: {
        Row: {
          automation_workflow_run_id: string | null
          current_health: Database["public"]["Enums"]["source_health"]
          evaluated_at: string
          evaluated_by: string | null
          id: string
          metrics: Json
          policy_version: string
          previous_health: Database["public"]["Enums"]["source_health"]
          reason: string
          run_id: string | null
          source_id: string
          workspace_id: string
        }
        Insert: {
          automation_workflow_run_id?: string | null
          current_health: Database["public"]["Enums"]["source_health"]
          evaluated_at?: string
          evaluated_by?: string | null
          id?: string
          metrics?: Json
          policy_version: string
          previous_health: Database["public"]["Enums"]["source_health"]
          reason: string
          run_id?: string | null
          source_id: string
          workspace_id: string
        }
        Update: {
          automation_workflow_run_id?: string | null
          current_health?: Database["public"]["Enums"]["source_health"]
          evaluated_at?: string
          evaluated_by?: string | null
          id?: string
          metrics?: Json
          policy_version?: string
          previous_health?: Database["public"]["Enums"]["source_health"]
          reason?: string
          run_id?: string | null
          source_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_health_events_automation_workflow_fkey"
            columns: ["workspace_id", "automation_workflow_run_id"]
            isOneToOne: false
            referencedRelation: "automation_workflow_runs"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "source_health_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_health_events_workspace_id_run_id_fkey"
            columns: ["workspace_id", "run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "source_health_events_workspace_id_source_id_fkey"
            columns: ["workspace_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_registry"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      source_registry: {
        Row: {
          adapter_type: string
          alert_owner: string | null
          approved_at: string | null
          approved_by: string | null
          auth_ref: string | null
          base_url: string | null
          cadence: string | null
          change_note: string | null
          changed_by: string | null
          checkpoint: Json
          controls: Json
          created_at: string
          effective_at: string
          enabled: boolean
          error_rate: number | null
          health: Database["public"]["Enums"]["source_health"]
          id: string
          jurisdiction: string | null
          last_attempt_at: string | null
          last_run_at: string | null
          last_success_at: string | null
          lookback: string | null
          name: string
          next_run_at: string | null
          owner: string | null
          permitted_method: string
          privacy_class: string
          reputation: Json
          retention_policy: Json
          schedule_enabled: boolean
          search_config: Json
          source_family: string
          terms_note: string | null
          timezone: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          adapter_type: string
          alert_owner?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auth_ref?: string | null
          base_url?: string | null
          cadence?: string | null
          change_note?: string | null
          changed_by?: string | null
          checkpoint?: Json
          controls?: Json
          created_at?: string
          effective_at?: string
          enabled?: boolean
          error_rate?: number | null
          health?: Database["public"]["Enums"]["source_health"]
          id?: string
          jurisdiction?: string | null
          last_attempt_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lookback?: string | null
          name: string
          next_run_at?: string | null
          owner?: string | null
          permitted_method: string
          privacy_class?: string
          reputation?: Json
          retention_policy?: Json
          schedule_enabled?: boolean
          search_config?: Json
          source_family: string
          terms_note?: string | null
          timezone?: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          adapter_type?: string
          alert_owner?: string | null
          approved_at?: string | null
          approved_by?: string | null
          auth_ref?: string | null
          base_url?: string | null
          cadence?: string | null
          change_note?: string | null
          changed_by?: string | null
          checkpoint?: Json
          controls?: Json
          created_at?: string
          effective_at?: string
          enabled?: boolean
          error_rate?: number | null
          health?: Database["public"]["Enums"]["source_health"]
          id?: string
          jurisdiction?: string | null
          last_attempt_at?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lookback?: string | null
          name?: string
          next_run_at?: string | null
          owner?: string | null
          permitted_method?: string
          privacy_class?: string
          reputation?: Json
          retention_policy?: Json
          schedule_enabled?: boolean
          search_config?: Json
          source_family?: string
          terms_note?: string | null
          timezone?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_registry_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      opportunity_dashboard: {
        Row: {
          budget: Json | null
          commercial_fit: Json | null
          confidence: number | null
          contact_hint: string | null
          description: string | null
          dimensions: Json | null
          evidence: Json | null
          first_seen_at: string | null
          id: string | null
          last_assessed_at: string | null
          lead_id: string | null
          lead_research_pending: boolean | null
          lead_status: Database["public"]["Enums"]["lead_status"] | null
          lead_version: number | null
          lifecycle_status:
            | Database["public"]["Enums"]["lifecycle_status"]
            | null
          location: string | null
          maturity_stage: Database["public"]["Enums"]["maturity_stage"] | null
          missing_fields: string[] | null
          organization: string | null
          primary_signal_type: string | null
          review_record: Json | null
          route: string | null
          score: number | null
          signal_count: number | null
          suggested_next_action: string | null
          technical_scope: Json | null
          title: string | null
          updated_at: string | null
          why_now: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bootstrap_dutch_agency_discovery: {
        Args: { p_workspace_id: string }
        Returns: {
          job_id: string
          profile_id: string
          source_id: string
        }[]
      }
      claim_automation_stage: {
        Args: { p_lease_seconds?: number; p_worker_id: string }
        Returns: {
          attempt: number
          available_at: string
          created_at: string
          error_code: string | null
          estimated_cost: number
          failure_reason: string | null
          finished_at: string | null
          id: string
          input_snapshot: Json
          lease_token: string | null
          leased_by: string | null
          leased_until: string | null
          output_snapshot: Json
          pass: number
          stage: Database["public"]["Enums"]["automation_stage"]
          started_at: string | null
          status: Database["public"]["Enums"]["automation_stage_status"]
          stop_reason: string | null
          usage: Json
          workflow_run_id: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_stage_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_workspace_automation_stage: {
        Args: {
          p_lease_seconds?: number
          p_worker_id: string
          p_workspace_id: string
        }
        Returns: {
          attempt: number
          available_at: string
          created_at: string
          error_code: string | null
          estimated_cost: number
          failure_reason: string | null
          finished_at: string | null
          id: string
          input_snapshot: Json
          lease_token: string | null
          leased_by: string | null
          leased_until: string | null
          output_snapshot: Json
          pass: number
          stage: Database["public"]["Enums"]["automation_stage"]
          started_at: string | null
          status: Database["public"]["Enums"]["automation_stage_status"]
          stop_reason: string | null
          usage: Json
          workflow_run_id: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_stage_runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_automation_stage: {
        Args: {
          p_estimated_cost: number
          p_lease_token: string
          p_next_stage?: Database["public"]["Enums"]["automation_stage"]
          p_output: Json
          p_stage_run_id: string
          p_terminal_status?: Database["public"]["Enums"]["automation_workflow_status"]
          p_usage: Json
        }
        Returns: undefined
      }
      complete_discovery_run: {
        Args: {
          p_health: Json
          p_results: Json
          p_run_id: string
          p_telemetry: Json
        }
        Returns: Json
      }
      create_qualified_lead_version: {
        Args: {
          p_final_assessment_id: string
          p_opportunity_id: string
          p_review_record: Json
          p_route: Database["public"]["Enums"]["lead_route"]
          p_suggested_next_action: string
          p_why_now: string
          p_workspace_id: string
        }
        Returns: string
      }
      create_workspace_with_owner: { Args: { p_name: string }; Returns: string }
      dispatch_due_automation: { Args: { p_limit?: number }; Returns: number }
      ensure_current_score_policy: {
        Args: {
          p_thresholds: Json
          p_version: string
          p_weights: Json
          p_workspace_id: string
        }
        Returns: string
      }
      fail_automation_stage: {
        Args: {
          p_error_code: string
          p_failure_reason: string
          p_lease_token: string
          p_retryable: boolean
          p_stage_run_id: string
        }
        Returns: undefined
      }
      fail_discovery_run: {
        Args: {
          p_duration_ms: number
          p_error_code: string
          p_failure_reason: string
          p_health: Json
          p_run_id: string
        }
        Returns: undefined
      }
      queue_source_monitor_now: {
        Args: {
          p_cost_limit_override?: number
          p_result_limit_override?: number
          p_source_id: string
        }
        Returns: string
      }
      retry_automation_workflow: {
        Args: { p_workflow_id: string }
        Returns: string
      }
      review_automation_exception: {
        Args: { p_decision: string; p_exception_id: string; p_note?: string }
        Returns: string
      }
      review_lead: {
        Args: {
          p_action: string
          p_expected_version: number
          p_idempotency_key?: string
          p_lead_id: string
          p_notes?: string
          p_reason_code?: string
          p_route?: Database["public"]["Enums"]["lead_route"]
        }
        Returns: Json
      }
      review_source_candidate: {
        Args: { p_candidate_id: string; p_decision: string; p_note?: string }
        Returns: string
      }
      save_lead_strategy: { Args: { p_strategy: Json }; Returns: string }
      set_discovery_job_enabled: {
        Args: { p_enabled: boolean; p_job_id: string }
        Returns: undefined
      }
      set_lead_automation_enabled: {
        Args: { p_enabled: boolean; p_workspace_id: string }
        Returns: undefined
      }
      start_discovery_run: {
        Args: {
          p_idempotency_key: string
          p_job_id: string
          p_workspace_id: string
        }
        Returns: string
      }
    }
    Enums: {
      assessment_decision:
        | "reject"
        | "research"
        | "review"
        | "qualify"
        | "nurture"
        | "monitor"
      assessment_type: "initial" | "final" | "human_adjusted"
      automation_stage:
        | "source_scout"
        | "source_monitor"
        | "normalize"
        | "resolve"
        | "first_assessment"
        | "gap_analysis"
        | "research"
        | "final_assessment"
        | "route"
      automation_stage_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "skipped"
        | "waiting"
      automation_workflow_kind:
        | "source_scout"
        | "source_monitor"
        | "opportunity_qualification"
      automation_workflow_status:
        | "queued"
        | "running"
        | "waiting_approval"
        | "succeeded"
        | "failed"
        | "cancelled"
      coverage_profile_status: "draft" | "active" | "paused" | "archived"
      delivery_route: "direct" | "partner" | "consortium" | "unsuitable"
      discovery_result_status: "accepted" | "rejected" | "duplicate"
      discovery_run_status:
        | "queued"
        | "running"
        | "succeeded"
        | "partial"
        | "failed"
      discovery_signal_area:
        | "pitching"
        | "newsletters"
        | "funding"
        | "strategy"
        | "hiring"
        | "consultations"
        | "announcements"
        | "regional_networks"
        | "other"
      finding_status:
        | "confirmed"
        | "strongly_inferred"
        | "contradicted"
        | "not_found"
        | "unknown"
      lead_route: "direct" | "partner" | "nurture" | "monitor"
      lead_status:
        | "draft"
        | "in_review"
        | "approved"
        | "delivered"
        | "accepted"
        | "rejected"
        | "archived"
      lifecycle_status:
        | "discovered"
        | "assessing"
        | "rejected"
        | "needs_research"
        | "ready_for_final_assessment"
        | "needs_review"
        | "qualified"
        | "delivered"
      maturity_stage:
        | "early_signal"
        | "exploring"
        | "funded"
        | "planning"
        | "selecting"
        | "formalized"
        | "closed"
      signal_type:
        | "funding"
        | "hiring"
        | "pitch"
        | "strategy"
        | "project"
        | "consultation"
        | "policy"
        | "roadmap"
        | "other"
      source_candidate_origin: "curated_pack" | "source_scout" | "operator"
      source_candidate_status:
        | "proposed"
        | "in_review"
        | "approved"
        | "rejected"
      source_health: "healthy" | "degraded" | "paused" | "failing"
      workspace_role: "owner" | "operator" | "reviewer" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assessment_decision: [
        "reject",
        "research",
        "review",
        "qualify",
        "nurture",
        "monitor",
      ],
      assessment_type: ["initial", "final", "human_adjusted"],
      automation_stage: [
        "source_scout",
        "source_monitor",
        "normalize",
        "resolve",
        "first_assessment",
        "gap_analysis",
        "research",
        "final_assessment",
        "route",
      ],
      automation_stage_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "skipped",
        "waiting",
      ],
      automation_workflow_kind: [
        "source_scout",
        "source_monitor",
        "opportunity_qualification",
      ],
      automation_workflow_status: [
        "queued",
        "running",
        "waiting_approval",
        "succeeded",
        "failed",
        "cancelled",
      ],
      coverage_profile_status: ["draft", "active", "paused", "archived"],
      delivery_route: ["direct", "partner", "consortium", "unsuitable"],
      discovery_result_status: ["accepted", "rejected", "duplicate"],
      discovery_run_status: [
        "queued",
        "running",
        "succeeded",
        "partial",
        "failed",
      ],
      discovery_signal_area: [
        "pitching",
        "newsletters",
        "funding",
        "strategy",
        "hiring",
        "consultations",
        "announcements",
        "regional_networks",
        "other",
      ],
      finding_status: [
        "confirmed",
        "strongly_inferred",
        "contradicted",
        "not_found",
        "unknown",
      ],
      lead_route: ["direct", "partner", "nurture", "monitor"],
      lead_status: [
        "draft",
        "in_review",
        "approved",
        "delivered",
        "accepted",
        "rejected",
        "archived",
      ],
      lifecycle_status: [
        "discovered",
        "assessing",
        "rejected",
        "needs_research",
        "ready_for_final_assessment",
        "needs_review",
        "qualified",
        "delivered",
      ],
      maturity_stage: [
        "early_signal",
        "exploring",
        "funded",
        "planning",
        "selecting",
        "formalized",
        "closed",
      ],
      signal_type: [
        "funding",
        "hiring",
        "pitch",
        "strategy",
        "project",
        "consultation",
        "policy",
        "roadmap",
        "other",
      ],
      source_candidate_origin: ["curated_pack", "source_scout", "operator"],
      source_candidate_status: [
        "proposed",
        "in_review",
        "approved",
        "rejected",
      ],
      source_health: ["healthy", "degraded", "paused", "failing"],
      workspace_role: ["owner", "operator", "reviewer", "viewer"],
    },
  },
} as const

