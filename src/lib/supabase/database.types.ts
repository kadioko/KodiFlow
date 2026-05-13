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
          full_name: string | null
          company_name: string | null
          phone: string | null
          currency_preference: string
          dashboard_hidden_property_ids: Json
          language_preference: 'en' | 'sw'
          late_fee_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          company_name?: string | null
          phone?: string | null
          currency_preference?: string
          dashboard_hidden_property_ids?: Json
          language_preference?: 'en' | 'sw'
          late_fee_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          company_name?: string | null
          phone?: string | null
          currency_preference?: string
          dashboard_hidden_property_ids?: Json
          language_preference?: 'en' | 'sw'
          late_fee_rate?: number
          created_at?: string
          updated_at?: string
        }
      }
      properties: {
        Row: {
          id: string
          user_id: string
          name: string
          property_type: 'residential' | 'commercial' | 'mixed_use'
          location: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          property_type: 'residential' | 'commercial' | 'mixed_use'
          location?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          property_type?: 'residential' | 'commercial' | 'mixed_use'
          location?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      property_sections: {
        Row: {
          id: string
          user_id: string
          property_id: string
          name: string
          section_type: 'floor' | 'block' | 'wing' | 'area' | 'compound' | 'market_zone' | 'parking_area' | 'other'
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          name: string
          section_type: 'floor' | 'block' | 'wing' | 'area' | 'compound' | 'market_zone' | 'parking_area' | 'other'
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          name?: string
          section_type?: 'floor' | 'block' | 'wing' | 'area' | 'compound' | 'market_zone' | 'parking_area' | 'other'
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      units: {
        Row: {
          id: string
          user_id: string
          property_id: string
          section_id: string | null
          unit_name: string
          unit_type: 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other'
          usage_type: 'residential' | 'commercial' | 'mixed'
          monthly_rent: number
          size: number | null
          size_unit: string
          status: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          section_id?: string | null
          unit_name: string
          unit_type: 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other'
          usage_type: 'residential' | 'commercial' | 'mixed'
          monthly_rent?: number
          size?: number | null
          size_unit?: string
          status?: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          section_id?: string | null
          unit_name?: string
          unit_type?: 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other'
          usage_type?: 'residential' | 'commercial' | 'mixed'
          monthly_rent?: number
          size?: number | null
          size_unit?: string
          status?: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tenants: {
        Row: {
          id: string
          user_id: string
          tenant_type: 'individual' | 'business' | 'organization'
          full_name: string | null
          business_name: string | null
          contact_person_name: string | null
          phone: string
          email: string | null
          id_number: string | null
          tin_number: string | null
          business_license_number: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          address: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_type: 'individual' | 'business' | 'organization'
          full_name?: string | null
          business_name?: string | null
          contact_person_name?: string | null
          phone: string
          email?: string | null
          id_number?: string | null
          tin_number?: string | null
          business_license_number?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_type?: 'individual' | 'business' | 'organization'
          full_name?: string | null
          business_name?: string | null
          contact_person_name?: string | null
          phone?: string
          email?: string | null
          id_number?: string | null
          tin_number?: string | null
          business_license_number?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leases: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          unit_id: string
          property_id: string
          start_date: string
          end_date: string
          monthly_rent: number
          deposit_amount: number
          deposit_paid_amount: number
          deposit_status: 'pending' | 'partial' | 'paid' | 'refunded'
          rent_due_day: number
          lease_type: 'residential' | 'commercial'
          billing_frequency: 'monthly' | 'quarterly' | 'semi_annually' | 'annually'
          rent_escalation_type: 'none' | 'percentage' | 'fixed_amount'
          rent_escalation_value: number | null
          rent_escalation_frequency: 'none' | 'annually' | 'custom'
          status: 'active' | 'expired' | 'terminated' | 'renewed' | 'pending'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          unit_id: string
          property_id: string
          start_date: string
          end_date: string
          monthly_rent: number
          deposit_amount?: number
          deposit_paid_amount?: number
          deposit_status?: 'pending' | 'partial' | 'paid' | 'refunded'
          rent_due_day?: number
          lease_type: 'residential' | 'commercial'
          billing_frequency?: 'monthly' | 'quarterly' | 'semi_annually' | 'annually'
          rent_escalation_type?: 'none' | 'percentage' | 'fixed_amount'
          rent_escalation_value?: number | null
          rent_escalation_frequency?: 'none' | 'annually' | 'custom'
          status?: 'active' | 'expired' | 'terminated' | 'renewed' | 'pending'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          unit_id?: string
          property_id?: string
          start_date?: string
          end_date?: string
          monthly_rent?: number
          deposit_amount?: number
          deposit_paid_amount?: number
          deposit_status?: 'pending' | 'partial' | 'paid' | 'refunded'
          rent_due_day?: number
          lease_type?: 'residential' | 'commercial'
          billing_frequency?: 'monthly' | 'quarterly' | 'semi_annually' | 'annually'
          rent_escalation_type?: 'none' | 'percentage' | 'fixed_amount'
          rent_escalation_value?: number | null
          rent_escalation_frequency?: 'none' | 'annually' | 'custom'
          status?: 'active' | 'expired' | 'terminated' | 'renewed' | 'pending'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      charges: {
        Row: {
          id: string
          user_id: string
          lease_id: string
          charge_name: string
          charge_type: 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other'
          amount: number
          frequency: 'monthly' | 'quarterly' | 'annually' | 'one_time' | 'custom'
          start_date: string | null
          end_date: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lease_id: string
          charge_name: string
          charge_type: 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other'
          amount: number
          frequency?: 'monthly' | 'quarterly' | 'annually' | 'one_time' | 'custom'
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lease_id?: string
          charge_name?: string
          charge_type?: 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other'
          amount?: number
          frequency?: 'monthly' | 'quarterly' | 'annually' | 'one_time' | 'custom'
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      rent_invoices: {
        Row: {
          id: string
          user_id: string
          lease_id: string
          tenant_id: string
          unit_id: string
          property_id: string
          invoice_number: string
          billing_period_start: string
          billing_period_end: string
          billing_month: number
          billing_year: number
          subtotal: number
          amount_paid: number
          balance: number
          due_date: string
          status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lease_id: string
          tenant_id: string
          unit_id: string
          property_id: string
          invoice_number?: string
          billing_period_start: string
          billing_period_end: string
          billing_month: number
          billing_year: number
          subtotal?: number
          amount_paid?: number
          due_date: string
          status?: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lease_id?: string
          tenant_id?: string
          unit_id?: string
          property_id?: string
          invoice_number?: string
          billing_period_start?: string
          billing_period_end?: string
          billing_month?: number
          billing_year?: number
          subtotal?: number
          amount_paid?: number
          due_date?: string
          status?: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          user_id: string
          invoice_id: string
          item_name: string
          item_type: 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other'
          amount: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          invoice_id: string
          item_name: string
          item_type: 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other'
          amount: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          invoice_id?: string
          item_name?: string
          item_type?: 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other'
          amount?: number
          notes?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          invoice_id: string
          tenant_id: string
          lease_id: string
          property_id: string
          unit_id: string
          amount: number
          payment_date: string
          payment_method: 'cash' | 'bank' | 'mobile_money' | 'cheque' | 'card' | 'other'
          reference: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          invoice_id: string
          tenant_id: string
          lease_id: string
          property_id: string
          unit_id: string
          amount: number
          payment_date: string
          payment_method: 'cash' | 'bank' | 'mobile_money' | 'cheque' | 'card' | 'other'
          reference?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          invoice_id?: string
          tenant_id?: string
          lease_id?: string
          property_id?: string
          unit_id?: string
          amount?: number
          payment_date?: string
          payment_method?: 'cash' | 'bank' | 'mobile_money' | 'cheque' | 'card' | 'other'
          reference?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          property_id: string
          section_id: string | null
          unit_id: string | null
          category: string
          amount: number
          expense_date: string
          vendor: string | null
          description: string | null
          notes: string | null
          receipt_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          section_id?: string | null
          unit_id?: string | null
          category: string
          amount: number
          expense_date: string
          vendor?: string | null
          description?: string | null
          notes?: string | null
          receipt_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          section_id?: string | null
          unit_id?: string | null
          category?: string
          amount?: number
          expense_date?: string
          vendor?: string | null
          description?: string | null
          notes?: string | null
          receipt_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          property_id: string | null
          tenant_id: string | null
          lease_id: string | null
          unit_id: string | null
          document_type: 'lease_agreement' | 'id_document' | 'business_license' | 'receipt' | 'inspection_report' | 'other'
          file_name: string
          file_url: string
          file_size: number | null
          mime_type: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id?: string | null
          tenant_id?: string | null
          lease_id?: string | null
          unit_id?: string | null
          document_type: 'lease_agreement' | 'id_document' | 'business_license' | 'receipt' | 'inspection_report' | 'other'
          file_name: string
          file_url: string
          file_size?: number | null
          mime_type?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string | null
          tenant_id?: string | null
          lease_id?: string | null
          unit_id?: string | null
          document_type?: 'lease_agreement' | 'id_document' | 'business_license' | 'receipt' | 'inspection_report' | 'other'
          file_name?: string
          file_url?: string
          file_size?: number | null
          mime_type?: string | null
          description?: string | null
          created_at?: string
        }
      }
      utility_meter_readings: {
        Row: {
          id: string
          user_id: string
          property_id: string
          unit_id: string | null
          utility_type: 'water' | 'electricity'
          previous_reading: number
          current_reading: number
          usage_amount: number
          rate_per_unit: number
          total_amount: number
          reading_date: string
          billing_month: number
          billing_year: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          unit_id?: string | null
          utility_type: 'water' | 'electricity'
          previous_reading?: number
          current_reading: number
          rate_per_unit?: number
          reading_date: string
          billing_month: number
          billing_year: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          unit_id?: string | null
          utility_type?: 'water' | 'electricity'
          previous_reading?: number
          current_reading?: number
          rate_per_unit?: number
          reading_date?: string
          billing_month?: number
          billing_year?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
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

