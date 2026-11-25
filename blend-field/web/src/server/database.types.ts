
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "site_dispatch_rules": {
              Row: { site_id: string; trade: string; member_id: string };
              Insert: { site_id: string; trade: string; member_id: string };
              Update: { site_id?: string; trade?: string; member_id?: string };
              Relationships: [];
            };
            "people_register": {
              Row: { id: string; org_id: string; site_id: string; kind: "tenant" | "trade"; first_name: string;
                surname: string; company: string; email: string; phone: string; trade: string; updated_at: string };
              Insert: Omit<Database["public"]["Tables"]["people_register"]["Row"], "id" | "updated_at"> & { updated_at?: string };
              Update: Partial<Database["public"]["Tables"]["people_register"]["Insert"]>;
              Relationships: [];
            };
            "tenant_profiles": {
              Row: { user_id: string; first_name: string; surname: string; company: string; phone: string; updated_at: string };
              Insert: { user_id: string; first_name: string; surname: string; company: string; phone: string; updated_at?: string };
              Update: Partial<Database["public"]["Tables"]["tenant_profiles"]["Insert"]>;
              Relationships: [];
            };
            "job_requester_contacts": {
              Row: { job_id: string; first_name: string; surname: string; company: string; email: string; phone: string };
              Insert: never; Update: never; Relationships: [];
            };
            "alerts": {
                  Row: {
                    "id": string,"job_id": string | null,"kind": Database["public"]['Enums']["alert_kind"],"member_id": string | null,"org_id": string,"raised_at": string,"resolved_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"job_id"?: string | null,"kind": Database["public"]['Enums']["alert_kind"],"member_id"?: string | null,"org_id": string,"raised_at"?: string,"resolved_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"job_id"?: string | null,"kind"?: Database["public"]['Enums']["alert_kind"],"member_id"?: string | null,"org_id"?: string,"raised_at"?: string,"resolved_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"assets": {
                  Row: {
                    "created_at": string,"custom": NonNullable<Json>,"id": string,"installed_on": string | null,"make": string | null,"model": string | null,"org_id": string,"qr_code": string,"serial": string | null,"site_id": string,"type": string,"updated_at": string,"warranty_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"custom"?: NonNullable<Json>,"id"?: string,"installed_on"?: string | null,"make"?: string | null,"model"?: string | null,"org_id": string,"qr_code"?: string,"serial"?: string | null,"site_id": string,"type": string,"updated_at"?: string,"warranty_until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"custom"?: NonNullable<Json>,"id"?: string,"installed_on"?: string | null,"make"?: string | null,"model"?: string | null,"org_id"?: string,"qr_code"?: string,"serial"?: string | null,"site_id"?: string,"type"?: string,"updated_at"?: string,"warranty_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assets_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assets_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "bytes": number | null,"content_type": string | null,"created_at": string,"created_by": string | null,"field_key": string | null,"id": string,"job_id": string,"kind": Database["public"]['Enums']["attachment_kind"],"lat": number | null,"lng": number | null,"org_id": string,"sha256": string | null,"signer_name": string | null,"stage": Database["public"]['Enums']["attachment_stage"],"storage_path": string | null,"submission_id": string | null,"taken_at": string,"uploaded_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bytes"?: number | null,"content_type"?: string | null,"created_at"?: string,"created_by"?: string | null,"field_key"?: string | null,"id": string,"job_id": string,"kind": Database["public"]['Enums']["attachment_kind"],"lat"?: number | null,"lng"?: number | null,"org_id": string,"sha256"?: string | null,"signer_name"?: string | null,"stage"?: Database["public"]['Enums']["attachment_stage"],"storage_path"?: string | null,"submission_id"?: string | null,"taken_at": string,"uploaded_at"?: string | null
                  }
                  Update: {
                    "bytes"?: number | null,"content_type"?: string | null,"created_at"?: string,"created_by"?: string | null,"field_key"?: string | null,"id"?: string,"job_id"?: string,"kind"?: Database["public"]['Enums']["attachment_kind"],"lat"?: number | null,"lng"?: number | null,"org_id"?: string,"sha256"?: string | null,"signer_name"?: string | null,"stage"?: Database["public"]['Enums']["attachment_stage"],"storage_path"?: string | null,"submission_id"?: string | null,"taken_at"?: string,"uploaded_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "form_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "accounting_ref": string | null,"approval_threshold_cents": number | null,"billing_address": string | null,"billing_email": string | null,"created_at": string,"id": string,"name": string,"org_id": string,"updated_at": string,"vat_number": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accounting_ref"?: string | null,"approval_threshold_cents"?: number | null,"billing_address"?: string | null,"billing_email"?: string | null,"created_at"?: string,"id"?: string,"name": string,"org_id": string,"updated_at"?: string,"vat_number"?: string | null
                  }
                  Update: {
                    "accounting_ref"?: string | null,"approval_threshold_cents"?: number | null,"billing_address"?: string | null,"billing_email"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"updated_at"?: string,"vat_number"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "access_windows": NonNullable<Json>,"client_id": string | null,"created_at": string,"email": string | null,"id": string,"name": string,"org_id": string,"phone_e164": string | null,"role": Database["public"]['Enums']["contact_role"],"site_id": string | null,"updated_at": string,"whatsapp_opt_in": boolean,"whatsapp_opt_in_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_windows"?: NonNullable<Json>,"client_id"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"name": string,"org_id": string,"phone_e164"?: string | null,"role": Database["public"]['Enums']["contact_role"],"site_id"?: string | null,"updated_at"?: string,"whatsapp_opt_in"?: boolean,"whatsapp_opt_in_at"?: string | null
                  }
                  Update: {
                    "access_windows"?: NonNullable<Json>,"client_id"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"phone_e164"?: string | null,"role"?: Database["public"]['Enums']["contact_role"],"site_id"?: string | null,"updated_at"?: string,"whatsapp_opt_in"?: boolean,"whatsapp_opt_in_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"form_submissions": {
                  Row: {
                    "answers": NonNullable<Json>,"completed": boolean,"completed_at": string | null,"completed_by": string | null,"created_at": string,"id": string,"job_form_id": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answers"?: NonNullable<Json>,"completed"?: boolean,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"id": string,"job_form_id": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"completed"?: boolean,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"id"?: string,"job_form_id"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_submissions_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_submissions_job_form_id_fkey"
      columns: ["job_form_id"]
isOneToOne: true
      referencedRelation: "job_forms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_submissions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"form_template_versions": {
                  Row: {
                    "created_at": string,"id": string,"pdf_layout": Json | null,"published_at": string,"schema": NonNullable<Json>,"template_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"pdf_layout"?: Json | null,"published_at"?: string,"schema": NonNullable<Json>,"template_id": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"pdf_layout"?: Json | null,"published_at"?: string,"schema"?: NonNullable<Json>,"template_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_template_versions_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "form_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"form_templates": {
                  Row: {
                    "archived": boolean,"created_at": string,"current_version_id": string | null,"id": string,"name": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"name": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived"?: boolean,"created_at"?: string,"current_version_id"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_templates_current_version_id_fkey"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "form_template_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_templates_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "created_at": string,"external_tenant_id": string | null,"id": string,"last_error": string | null,"org_id": string,"provider": string,"secret_id": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"external_tenant_id"?: string | null,"id"?: string,"last_error"?: string | null,"org_id": string,"provider": string,"secret_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"external_tenant_id"?: string | null,"id"?: string,"last_error"?: string | null,"org_id"?: string,"provider"?: string,"secret_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "client_id": string,"created_at": string,"currency": string,"due_at": string | null,"external_ref": string | null,"id": string,"issued_at": string | null,"job_id": string | null,"org_id": string,"state": Database["public"]['Enums']["invoice_state"],"subtotal_cents": number,"total_cents": number,"updated_at": string,"vat_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"currency"?: string,"due_at"?: string | null,"external_ref"?: string | null,"id"?: string,"issued_at"?: string | null,"job_id"?: string | null,"org_id": string,"state"?: Database["public"]['Enums']["invoice_state"],"subtotal_cents"?: number,"total_cents"?: number,"updated_at"?: string,"vat_cents"?: number
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"currency"?: string,"due_at"?: string | null,"external_ref"?: string | null,"id"?: string,"issued_at"?: string | null,"job_id"?: string | null,"org_id"?: string,"state"?: Database["public"]['Enums']["invoice_state"],"subtotal_cents"?: number,"total_cents"?: number,"updated_at"?: string,"vat_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_assignments": {
                  Row: {
                    "assigned_at": string,"is_lead": boolean,"job_id": string,"member_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"is_lead"?: boolean,"job_id": string,"member_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"is_lead"?: boolean,"job_id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_assignments_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_assignments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"job_events": {
                  Row: {
                    "client_op_id": string | null,"from_stage": Database["public"]['Enums']["job_stage"] | null,"id": string,"job_id": string,"kind": string,"lat": number | null,"lng": number | null,"member_id": string | null,"occurred_at": string,"org_id": string,"payload": NonNullable<Json>,"received_at": string,"to_stage": Database["public"]['Enums']["job_stage"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_op_id"?: string | null,"from_stage"?: Database["public"]['Enums']["job_stage"] | null,"id"?: string,"job_id": string,"kind": string,"lat"?: number | null,"lng"?: number | null,"member_id"?: string | null,"occurred_at": string,"org_id": string,"payload"?: NonNullable<Json>,"received_at"?: string,"to_stage"?: Database["public"]['Enums']["job_stage"] | null
                  }
                  Update: {
                    "client_op_id"?: string | null,"from_stage"?: Database["public"]['Enums']["job_stage"] | null,"id"?: string,"job_id"?: string,"kind"?: string,"lat"?: number | null,"lng"?: number | null,"member_id"?: string | null,"occurred_at"?: string,"org_id"?: string,"payload"?: NonNullable<Json>,"received_at"?: string,"to_stage"?: Database["public"]['Enums']["job_stage"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_events_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_events_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_events_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_forms": {
                  Row: {
                    "id": string,"job_id": string,"required": boolean,"template_version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"job_id": string,"required"?: boolean,"template_version_id": string
                  }
                  Update: {
                    "id"?: string,"job_id"?: string,"required"?: boolean,"template_version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_forms_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_forms_template_version_id_fkey"
      columns: ["template_version_id"]
isOneToOne: false
      referencedRelation: "form_template_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"job_statuses": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"notify_customer": boolean,"org_id": string,"sort": number,"stage": Database["public"]['Enums']["job_stage"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": string,"notify_customer"?: boolean,"org_id": string,"sort": number,"stage": Database["public"]['Enums']["job_stage"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"notify_customer"?: boolean,"org_id"?: string,"sort"?: number,"stage"?: Database["public"]['Enums']["job_stage"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_statuses_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_type_forms": {
                  Row: {
                    "job_type_id": string,"required": boolean,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "job_type_id": string,"required"?: boolean,"template_id": string
                  }
                  Update: {
                    "job_type_id"?: string,"required"?: boolean,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_type_forms_job_type_id_fkey"
      columns: ["job_type_id"]
isOneToOne: false
      referencedRelation: "job_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_type_forms_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "form_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"job_type_resolutions": {
                  Row: {
                    "job_type_id": string,"resolution_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "job_type_id": string,"resolution_id": string
                  }
                  Update: {
                    "job_type_id"?: string,"resolution_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_type_resolutions_job_type_id_fkey"
      columns: ["job_type_id"]
isOneToOne: false
      referencedRelation: "job_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_type_resolutions_resolution_id_fkey"
      columns: ["resolution_id"]
isOneToOne: false
      referencedRelation: "resolutions"
      referencedColumns: ["id"]
    }
                  ]
                },"job_types": {
                  Row: {
                    "created_at": string,"default_estimate_min": number | null,"id": string,"name": string,"org_id": string,"required_skills": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_estimate_min"?: number | null,"id"?: string,"name": string,"org_id": string,"required_skills"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"default_estimate_min"?: number | null,"id"?: string,"name"?: string,"org_id"?: string,"required_skills"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_types_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "requester_user_id": string | null,"approval": Database["public"]['Enums']["approval_state"],"trade": string | null,"preferred_worker": string | null,"arrived_at": string | null,"client_id": string,"completed_at": string | null,"created_at": string,"created_by": string | null,"deadline": string | null,"description": string | null,"estimate_min": number | null,"id": string,"job_type_id": string | null,"locked_at": string | null,"number": number,"on_site_seconds": number | null,"org_id": string,"ppm_schedule_id": string | null,"priority": number,"resolution_comment": string | null,"resolution_id": string | null,"scheduled_end": string | null,"scheduled_start": string | null,"site_id": string,"source": Database["public"]['Enums']["job_source"],"stage": Database["public"]['Enums']["job_stage"],"started_at": string | null,"status_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "requester_user_id"?: string | null,"approval"?: Database["public"]['Enums']["approval_state"],"trade"?: string | null,"preferred_worker"?: string | null,"arrived_at"?: string | null,"client_id": string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deadline"?: string | null,"description"?: string | null,"estimate_min"?: number | null,"id"?: string,"job_type_id"?: string | null,"locked_at"?: string | null,"number": number,"on_site_seconds"?: number | null,"org_id": string,"ppm_schedule_id"?: string | null,"priority"?: number,"resolution_comment"?: string | null,"resolution_id"?: string | null,"scheduled_end"?: string | null,"scheduled_start"?: string | null,"site_id": string,"source"?: Database["public"]['Enums']["job_source"],"stage"?: Database["public"]['Enums']["job_stage"],"started_at"?: string | null,"status_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "requester_user_id"?: string | null,"approval"?: Database["public"]['Enums']["approval_state"],"trade"?: string | null,"preferred_worker"?: string | null,"arrived_at"?: string | null,"client_id"?: string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deadline"?: string | null,"description"?: string | null,"estimate_min"?: number | null,"id"?: string,"job_type_id"?: string | null,"locked_at"?: string | null,"number"?: number,"on_site_seconds"?: number | null,"org_id"?: string,"ppm_schedule_id"?: string | null,"priority"?: number,"resolution_comment"?: string | null,"resolution_id"?: string | null,"scheduled_end"?: string | null,"scheduled_start"?: string | null,"site_id"?: string,"source"?: Database["public"]['Enums']["job_source"],"stage"?: Database["public"]['Enums']["job_stage"],"started_at"?: string | null,"status_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_job_type_id_fkey"
      columns: ["job_type_id"]
isOneToOne: false
      referencedRelation: "job_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_ppm_schedule_id_fkey"
      columns: ["ppm_schedule_id"]
isOneToOne: false
      referencedRelation: "ppm_schedules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_resolution_id_fkey"
      columns: ["resolution_id"]
isOneToOne: false
      referencedRelation: "resolutions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_status_id_fkey"
      columns: ["status_id"]
isOneToOne: false
      referencedRelation: "job_statuses"
      referencedColumns: ["id"]
    }
                  ]
                },"line_items": {
                  Row: {
                    "description": string,"id": string,"invoice_id": string | null,"kind": string,"qty": number,"quote_id": string | null,"sort": number,"unit_cents": number,"vat_rate": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id"?: string,"invoice_id"?: string | null,"kind": string,"qty": number,"quote_id"?: string | null,"sort"?: number,"unit_cents": number,"vat_rate"?: number
                  }
                  Update: {
                    "description"?: string,"id"?: string,"invoice_id"?: string | null,"kind"?: string,"qty"?: number,"quote_id"?: string | null,"sort"?: number,"unit_cents"?: number,"vat_rate"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "line_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "line_items_quote_id_fkey"
      columns: ["quote_id"]
isOneToOne: false
      referencedRelation: "quotes"
      referencedColumns: ["id"]
    }
                  ]
                },"location_pings": {
                  Row: {
                    "accuracy_m": number | null,"id": number,"job_id": string | null,"lat": number,"lng": number,"member_id": string,"recorded_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"id"?: never,"job_id"?: string | null,"lat": number,"lng": number,"member_id": string,"recorded_at": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"id"?: never,"job_id"?: string | null,"lat"?: number,"lng"?: number,"member_id"?: string,"recorded_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_pings_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"member_locations": {
                  Row: {
                    "accuracy_m": number | null,"lat": number,"lng": number,"member_id": string,"org_id": string,"recorded_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"lat": number,"lng": number,"member_id": string,"org_id": string,"recorded_at": string,"updated_at"?: string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"lat"?: number,"lng"?: number,"member_id"?: string,"org_id"?: string,"recorded_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_locations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_locations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "active": boolean,"created_at": string,"display_name": string,"home_lat": number | null,"home_lng": number | null,"hourly_cost_cents": number | null,"id": string,"org_id": string,"phone": string | null,"role": Database["public"]['Enums']["member_role"],"skills": (string)[],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"display_name": string,"home_lat"?: number | null,"home_lng"?: number | null,"hourly_cost_cents"?: number | null,"id"?: string,"org_id": string,"phone"?: string | null,"role": Database["public"]['Enums']["member_role"],"skills"?: (string)[],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"display_name"?: string,"home_lat"?: number | null,"home_lng"?: number | null,"hourly_cost_cents"?: number | null,"id"?: string,"org_id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"skills"?: (string)[],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "channel": Database["public"]['Enums']["channel"],"contact_id": string | null,"created_at": string,"dedupe_key": string,"error": string | null,"id": string,"job_id": string | null,"org_id": string,"provider_message_id": string | null,"sent_at": string | null,"state": Database["public"]['Enums']["notify_state"],"template": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": Database["public"]['Enums']["channel"],"contact_id"?: string | null,"created_at"?: string,"dedupe_key": string,"error"?: string | null,"id"?: string,"job_id"?: string | null,"org_id": string,"provider_message_id"?: string | null,"sent_at"?: string | null,"state"?: Database["public"]['Enums']["notify_state"],"template": string
                  }
                  Update: {
                    "channel"?: Database["public"]['Enums']["channel"],"contact_id"?: string | null,"created_at"?: string,"dedupe_key"?: string,"error"?: string | null,"id"?: string,"job_id"?: string | null,"org_id"?: string,"provider_message_id"?: string | null,"sent_at"?: string | null,"state"?: Database["public"]['Enums']["notify_state"],"template"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"orgs": {
                  Row: {
                    "created_at": string,"currency": string,"id": string,"name": string,"next_job_number": number,"settings": NonNullable<Json>,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"id"?: string,"name": string,"next_job_number"?: number,"settings"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"id"?: string,"name"?: string,"next_job_number"?: number,"settings"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"created_at": string,"currency": string,"id": string,"invoice_id": string,"org_id": string,"paid_at": string,"provider": string,"provider_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"currency"?: string,"id"?: string,"invoice_id": string,"org_id": string,"paid_at": string,"provider": string,"provider_ref"?: string | null
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"invoice_id"?: string,"org_id"?: string,"paid_at"?: string,"provider"?: string,"provider_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"ppm_schedules": {
                  Row: {
                    "active": boolean,"asset_id": string,"created_at": string,"id": string,"job_type_id": string | null,"lead_days": number,"next_due": string,"org_id": string,"remind_days": number,"rrule": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"asset_id": string,"created_at"?: string,"id"?: string,"job_type_id"?: string | null,"lead_days"?: number,"next_due": string,"org_id": string,"remind_days"?: number,"rrule": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"asset_id"?: string,"created_at"?: string,"id"?: string,"job_type_id"?: string | null,"lead_days"?: number,"next_due"?: string,"org_id"?: string,"remind_days"?: number,"rrule"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ppm_schedules_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ppm_schedules_job_type_id_fkey"
      columns: ["job_type_id"]
isOneToOne: false
      referencedRelation: "job_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ppm_schedules_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"quotes": {
                  Row: {
                    "approval_token_hash": string | null,"created_at": string,"currency": string,"decided_at": string | null,"decided_by_contact": string | null,"expires_at": string | null,"id": string,"job_id": string,"org_id": string,"sent_at": string | null,"state": Database["public"]['Enums']["quote_state"],"total_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_token_hash"?: string | null,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"decided_by_contact"?: string | null,"expires_at"?: string | null,"id"?: string,"job_id": string,"org_id": string,"sent_at"?: string | null,"state"?: Database["public"]['Enums']["quote_state"],"total_cents"?: number,"updated_at"?: string
                  }
                  Update: {
                    "approval_token_hash"?: string | null,"created_at"?: string,"currency"?: string,"decided_at"?: string | null,"decided_by_contact"?: string | null,"expires_at"?: string | null,"id"?: string,"job_id"?: string,"org_id"?: string,"sent_at"?: string | null,"state"?: Database["public"]['Enums']["quote_state"],"total_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_decided_by_contact_fkey"
      columns: ["decided_by_contact"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"resolutions": {
                  Row: {
                    "archived": boolean,"created_at": string,"id": string,"name": string,"org_id": string,"requires_comment": boolean,"sort": number,"successful": boolean,"suggest_follow_up": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"created_at"?: string,"id"?: string,"name": string,"org_id": string,"requires_comment"?: boolean,"sort"?: number,"successful": boolean,"suggest_follow_up"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "archived"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"requires_comment"?: boolean,"sort"?: number,"successful"?: boolean,"suggest_follow_up"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resolutions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    }
                  ]
                },"service_records": {
                  Row: {
                    "asset_id": string,"created_at": string,"id": string,"job_id": string | null,"notes": string | null,"performed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "asset_id": string,"created_at"?: string,"id"?: string,"job_id"?: string | null,"notes"?: string | null,"performed_at": string
                  }
                  Update: {
                    "asset_id"?: string,"created_at"?: string,"id"?: string,"job_id"?: string | null,"notes"?: string | null,"performed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_records_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"sites": {
                  Row: {
                    "access_notes": string | null,"address": string,"client_id": string,"created_at": string,"geofence_m": number,"id": string,"label": string,"lat": number | null,"lng": number | null,"org_id": string,"parent_site_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_notes"?: string | null,"address": string,"client_id": string,"created_at"?: string,"geofence_m"?: number,"id"?: string,"label": string,"lat"?: number | null,"lng"?: number | null,"org_id": string,"parent_site_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "access_notes"?: string | null,"address"?: string,"client_id"?: string,"created_at"?: string,"geofence_m"?: number,"id"?: string,"label"?: string,"lat"?: number | null,"lng"?: number | null,"org_id"?: string,"parent_site_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sites_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "orgs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sites_parent_site_id_fkey"
      columns: ["parent_site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "external_id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "external_id": string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "external_id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "office_tenant_contacts": { Args: { p_org: string }; Returns: {
              user_id: string; site_id: string; first_name: string; surname: string; company: string;
            }[] };
            "tenant_sites": { Args: Record<string, never>; Returns: { id: string; label: string }[] };
            "my_workflow_alerts": { Args: { p_audience: string }; Returns: { event_id: string; job_id: string; number: number; message: string; created_at: string }[] };
            "set_site_dispatch_rule": { Args: { p_site: string; p_trade: string; p_member: string | null }; Returns: undefined };
            "tenant_requests": { Args: Record<string, never>; Returns: { number: number; title: string; status: string; logged_at: string }[] };
            "submit_tenant_request": { Args: { p_site: string; p_trade: string; p_title: string; p_description: string; p_manual?: boolean }; Returns: number };
            "review_job": { Args: { p_job: string; p_decision: string }; Returns: undefined };
            "assign_job":
{ Args: { "p_job": string,"p_members": (string)[] }; Returns: {
              "requester_user_id": string | null,"approval": Database["public"]['Enums']["approval_state"],"trade": string | null,"preferred_worker": string | null,
"arrived_at": string | null,
"client_id": string,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"deadline": string | null,
"description": string | null,
"estimate_min": number | null,
"id": string,
"job_type_id": string | null,
"locked_at": string | null,
"number": number,
"on_site_seconds": number | null,
"org_id": string,
"ppm_schedule_id": string | null,
"priority": number,
"resolution_comment": string | null,
"resolution_id": string | null,
"scheduled_end": string | null,
"scheduled_start": string | null,
"site_id": string,
"source": Database["public"]['Enums']["job_source"],
"stage": Database["public"]['Enums']["job_stage"],
"started_at": string | null,
"status_id": string | null,
"title": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "jobs"
        isOneToOne: true
        isSetofReturn: false
      } },
"assigned_to_me":
{ Args: { "p_job": string }; Returns: boolean
                           },
"field_apply_ops":
{ Args: { "p_ops": Json }; Returns: Json
                           },
"field_mark_uploaded":
{ Args: { "p_attachment": string,"p_path": string }; Returns: {
              "bytes": number | null,
"content_type": string | null,
"created_at": string,
"created_by": string | null,
"field_key": string | null,
"id": string,
"job_id": string,
"kind": Database["public"]['Enums']["attachment_kind"],
"lat": number | null,
"lng": number | null,
"org_id": string,
"sha256": string | null,
"signer_name": string | null,
"stage": Database["public"]['Enums']["attachment_stage"],
"storage_path": string | null,
"submission_id": string | null,
"taken_at": string,
"uploaded_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "attachments"
        isOneToOne: true
        isSetofReturn: false
      } },
"is_office":
{ Args: { "p_org": string }; Returns: boolean
                           },
"job_org":
{ Args: { "p_job": string }; Returns: string
                           },
"my_org_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_role":
{ Args: { "p_org": string }; Returns: Database["public"]['Enums']["member_role"]
                           },
"seed_default_resolutions":
{ Args: { "p_org": string }; Returns: undefined
                           },
"stage_label":
{ Args: { "s": Database["public"]['Enums']["job_stage"] }; Returns: string
                           }
          }
          Enums: {
            "alert_kind": "overrun"|"no_checkin"|"late_start"|"sync_stale","approval_state": "not_required"|"awaiting"|"approved"|"rejected","attachment_kind": "photo"|"signature"|"document","attachment_stage": "before"|"during"|"after"|"other","channel": "whatsapp"|"sms"|"email","contact_role": "owner"|"tenant"|"agent"|"other","invoice_state": "draft"|"issued"|"paid"|"void","job_source": "manual"|"ppm"|"mobile"|"tenant_request","job_stage": "unassigned"|"assigned"|"en_route"|"arrived"|"in_progress"|"pending"|"completed"|"cancelled","member_role": "admin"|"office"|"engineer"|"contractor"|"facility_manager","notify_state": "queued"|"sent"|"delivered"|"read"|"failed","quote_state": "draft"|"sent"|"approved"|"rejected"|"expired"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "alert_kind": ["overrun", "no_checkin", "late_start", "sync_stale"],"approval_state": ["not_required", "awaiting", "approved", "rejected"],"attachment_kind": ["photo", "signature", "document"],"attachment_stage": ["before", "during", "after", "other"],"channel": ["whatsapp", "sms", "email"],"contact_role": ["owner", "tenant", "agent", "other"],"invoice_state": ["draft", "issued", "paid", "void"],"job_source": ["manual", "ppm", "mobile", "tenant_request"],"job_stage": ["unassigned", "assigned", "en_route", "arrived", "in_progress", "pending", "completed", "cancelled"],"member_role": ["admin", "office", "engineer", "contractor", "facility_manager"],"notify_state": ["queued", "sent", "delivered", "read", "failed"],"quote_state": ["draft", "sent", "approved", "rejected", "expired"]
          }
        }
} as const
