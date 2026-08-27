/**
 * Hand-authored database types kept in sync with the SQL migrations under
 * /supabase/migrations. When the schema changes, update both. (You can later
 * replace this with `supabase gen types typescript` output.)
 */

export type UserRole = "admin" | "teacher" | "parent"
export type EnrollmentStatus = "active" | "waitlisted" | "withdrawn"
export type ReportStatus = "draft" | "published"
export type BillingCycle = "monthly" | "termly" | "annual"
export type InvoiceStatus = "unpaid" | "partial" | "paid" | "overdue"
export type PaymentMethod = "cash" | "ecocash" | "bank_transfer" | "other"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface EmergencyContact {
  name: string
  phone: string
  relationship?: string
}

export interface AuthorizedPickup {
  name: string
  photo_url?: string | null
  pin?: string | null
  relationship?: string
}

export interface MealEntry {
  time?: string
  food?: string
  amount?: "none" | "some" | "most" | "all"
}

export interface NapEntry {
  start?: string
  end?: string
}

export interface BathroomEntry {
  time?: string
  type?: "wet" | "bm" | "dry" | "potty"
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          full_name: string | null
          phone: string | null
          preferred_language: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          full_name?: string | null
          phone?: string | null
          preferred_language?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      classrooms: {
        Row: {
          id: string
          name: string
          max_capacity: number
          teacher_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          max_capacity?: number
          teacher_id?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["classrooms"]["Insert"]>
        Relationships: []
      }
      children: {
        Row: {
          id: string
          full_name: string
          date_of_birth: string | null
          photo_url: string | null
          allergies: string[]
          medical_notes: string | null
          emergency_contacts: EmergencyContact[]
          authorized_pickups: AuthorizedPickup[]
          classroom_id: string | null
          enrollment_status: EnrollmentStatus
          enrolled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          full_name: string
          date_of_birth?: string | null
          photo_url?: string | null
          allergies?: string[]
          medical_notes?: string | null
          emergency_contacts?: EmergencyContact[]
          authorized_pickups?: AuthorizedPickup[]
          classroom_id?: string | null
          enrollment_status?: EnrollmentStatus
          enrolled_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["children"]["Insert"]>
        Relationships: []
      }
      parent_children: {
        Row: {
          parent_id: string
          child_id: string
          relationship: string | null
        }
        Insert: {
          parent_id: string
          child_id: string
          relationship?: string | null
        }
        Update: Partial<
          Database["public"]["Tables"]["parent_children"]["Insert"]
        >
        Relationships: []
      }
      attendance: {
        Row: {
          id: string
          child_id: string
          date: string
          check_in_at: string | null
          check_out_at: string | null
          check_in_by: string | null
          check_out_by: string | null
        }
        Insert: {
          id?: string
          child_id: string
          date: string
          check_in_at?: string | null
          check_out_at?: string | null
          check_in_by?: string | null
          check_out_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>
        Relationships: []
      }
      daily_reports: {
        Row: {
          id: string
          child_id: string
          date: string
          meals: MealEntry[]
          naps: NapEntry[]
          bathroom: BathroomEntry[]
          mood: string | null
          activities: string | null
          notes: string | null
          photos: string[]
          status: ReportStatus
          ai_generated: boolean
          created_by: string | null
          published_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          child_id: string
          date: string
          meals?: MealEntry[]
          naps?: NapEntry[]
          bathroom?: BathroomEntry[]
          mood?: string | null
          activities?: string | null
          notes?: string | null
          photos?: string[]
          status?: ReportStatus
          ai_generated?: boolean
          created_by?: string | null
          published_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["daily_reports"]["Insert"]>
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          child_id: string
          sender_id: string
          body: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          child_id: string
          sender_id: string
          body: string
          created_at?: string
          read_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>
        Relationships: []
      }
      fee_plans: {
        Row: {
          id: string
          name: string
          amount: number
          billing_cycle: BillingCycle
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          amount: number
          billing_cycle: BillingCycle
          description?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["fee_plans"]["Insert"]>
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          child_id: string
          fee_plan_id: string | null
          period_label: string
          amount_due: number
          due_date: string
          status: InvoiceStatus
          issued_at: string
        }
        Insert: {
          id?: string
          child_id: string
          fee_plan_id?: string | null
          period_label: string
          amount_due: number
          due_date: string
          status?: InvoiceStatus
          issued_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          invoice_id: string | null
          child_id: string
          amount: number
          method: PaymentMethod
          receipt_number: string
          paid_at: string
          recorded_by: string | null
        }
        Insert: {
          id?: string
          invoice_id?: string | null
          child_id: string
          amount: number
          method: PaymentMethod
          receipt_number?: string
          paid_at?: string
          recorded_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>
        Relationships: []
      }
    }
    Views: {
      child_balances: {
        Row: {
          child_id: string
          total_invoiced: number
          total_paid: number
          balance: number
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_parent_of: {
        Args: { child: string }
        Returns: boolean
      }
      teaches_child: {
        Args: { child: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      enrollment_status: EnrollmentStatus
      report_status: ReportStatus
      billing_cycle: BillingCycle
      invoice_status: InvoiceStatus
      payment_method: PaymentMethod
    }
  }
}

// Convenience row aliases.
type Tables = Database["public"]["Tables"]
export type Profile = Tables["profiles"]["Row"]
export type Classroom = Tables["classrooms"]["Row"]
export type Child = Tables["children"]["Row"]
export type ParentChild = Tables["parent_children"]["Row"]
export type Attendance = Tables["attendance"]["Row"]
export type DailyReport = Tables["daily_reports"]["Row"]
export type Message = Tables["messages"]["Row"]
export type FeePlan = Tables["fee_plans"]["Row"]
export type Invoice = Tables["invoices"]["Row"]
export type Payment = Tables["payments"]["Row"]
export type ChildBalance = Database["public"]["Views"]["child_balances"]["Row"]
