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
          email: string | null
          admin_role: 'none' | 'admin' | 'super_admin'
          company_name: string | null
          phone: string | null
          currency_preference: string
          dashboard_hidden_property_ids: Json
          language_preference: 'en' | 'sw'
          late_fee_rate: number
          invoice_payment_instructions: string | null
          invoice_footer_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          admin_role?: 'none' | 'admin' | 'super_admin'
          company_name?: string | null
          phone?: string | null
          currency_preference?: string
          dashboard_hidden_property_ids?: Json
          language_preference?: 'en' | 'sw'
          late_fee_rate?: number
          invoice_payment_instructions?: string | null
          invoice_footer_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          admin_role?: 'none' | 'admin' | 'super_admin'
          company_name?: string | null
          phone?: string | null
          currency_preference?: string
          dashboard_hidden_property_ids?: Json
          language_preference?: 'en' | 'sw'
          late_fee_rate?: number
          invoice_payment_instructions?: string | null
          invoice_footer_note?: string | null
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
          unit_identifier: string | null
          unit_type: 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other'
          usage_type: 'residential' | 'commercial' | 'mixed'
          monthly_rent: number
          size: number | null
          size_unit: string
          status: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive'
          notes: string | null
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          section_id?: string | null
          unit_name: string
          unit_identifier?: string | null
          unit_type: 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other'
          usage_type: 'residential' | 'commercial' | 'mixed'
          monthly_rent?: number
          size?: number | null
          size_unit?: string
          status?: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive'
          notes?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          section_id?: string | null
          unit_name?: string
          unit_identifier?: string | null
          unit_type?: 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other'
          usage_type?: 'residential' | 'commercial' | 'mixed'
          monthly_rent?: number
          size?: number | null
          size_unit?: string
          status?: 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive'
          notes?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
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
          rent_withholding_tax_enabled: boolean
          service_charge_withholding_tax_enabled: boolean
          rent_withholding_tax_rate: number
          service_charge_withholding_tax_rate: number
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
          rent_withholding_tax_enabled?: boolean
          service_charge_withholding_tax_enabled?: boolean
          rent_withholding_tax_rate?: number
          service_charge_withholding_tax_rate?: number
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
          rent_withholding_tax_enabled?: boolean
          service_charge_withholding_tax_enabled?: boolean
          rent_withholding_tax_rate?: number
          service_charge_withholding_tax_rate?: number
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
          status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'transferred'
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
          status?: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'transferred'
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
          status?: 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'transferred'
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
          client_request_id: string | null
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
          reversal_payment_id: string | null
          reverses_payment_id: string | null
          is_reversal: boolean
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
          client_request_id?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          reversal_payment_id?: string | null
          reverses_payment_id?: string | null
          is_reversal?: boolean
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
          client_request_id?: string | null
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          reversal_payment_id?: string | null
          reverses_payment_id?: string | null
          is_reversal?: boolean
          created_at?: string
        }
      }
      activity_log: {
        Row: { id: string; user_id: string; actor_user_id: string | null; entity_type: string; entity_id: string; action: string; summary: string | null; metadata: Json; created_at: string }
        Insert: { id?: string; user_id: string; actor_user_id?: string | null; entity_type: string; entity_id: string; action: string; summary?: string | null; metadata?: Json; created_at?: string }
        Update: { id?: string; user_id?: string; actor_user_id?: string | null; entity_type?: string; entity_id?: string; action?: string; summary?: string | null; metadata?: Json; created_at?: string }
      }
      maintenance_requests: {
        Row: { id: string; user_id: string; property_id: string; unit_id: string | null; tenant_id: string | null; title: string; description: string | null; status: 'new' | 'assigned' | 'in_progress' | 'waiting_for_tenant' | 'completed' | 'closed'; priority: 'low' | 'medium' | 'high' | 'urgent'; vendor_name: string | null; assigned_to: string | null; estimated_cost: number | null; actual_cost: number | null; expense_id: string | null; due_date: string | null; completed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; property_id: string; unit_id?: string | null; tenant_id?: string | null; title: string; description?: string | null; status?: 'new' | 'assigned' | 'in_progress' | 'waiting_for_tenant' | 'completed' | 'closed'; priority?: 'low' | 'medium' | 'high' | 'urgent'; vendor_name?: string | null; assigned_to?: string | null; estimated_cost?: number | null; actual_cost?: number | null; expense_id?: string | null; due_date?: string | null; completed_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; property_id?: string; unit_id?: string | null; tenant_id?: string | null; title?: string; description?: string | null; status?: 'new' | 'assigned' | 'in_progress' | 'waiting_for_tenant' | 'completed' | 'closed'; priority?: 'low' | 'medium' | 'high' | 'urgent'; vendor_name?: string | null; assigned_to?: string | null; estimated_cost?: number | null; actual_cost?: number | null; expense_id?: string | null; due_date?: string | null; completed_at?: string | null; created_at?: string; updated_at?: string }
      }
      maintenance_attachments: {
        Row: { id: string; user_id: string; maintenance_request_id: string; file_name: string; file_url: string; mime_type: string | null; file_size: number | null; created_at: string }
        Insert: { id?: string; user_id: string; maintenance_request_id: string; file_name: string; file_url: string; mime_type?: string | null; file_size?: number | null; created_at?: string }
        Update: { id?: string; user_id?: string; maintenance_request_id?: string; file_name?: string; file_url?: string; mime_type?: string | null; file_size?: number | null; created_at?: string }
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
      charge_amount_for_billing_period: {
        Args: {
          p_amount: number
          p_charge_frequency: string
          p_billing_frequency: string
        }
        Returns: number
      }
      billing_frequency_months: {
        Args: {
          p_frequency: string
        }
        Returns: number
      }
      create_rent_invoice_for_lease: {
        Args: {
          p_lease_id: string
          p_billing_month: number
          p_billing_year: number
          p_due_day?: number
        }
        Returns: {
          invoice_id: string
          result: 'created' | 'skipped'
        }[]
      }
      expire_stale_leases: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      record_invoice_payment: {
        Args: {
          p_invoice_id: string
          p_amount: number
          p_payment_date: string
          p_payment_method: 'cash' | 'bank' | 'mobile_money' | 'cheque' | 'card' | 'other'
          p_reference?: string | null
          p_notes?: string | null
          p_client_request_id?: string | null
        }
        Returns: string
      }
      refresh_overdue_invoices: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      reverse_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: string
      }
      renew_lease: {
        Args: {
          p_lease_id: string
          p_new_end_date: string
          p_new_rent: number
          p_new_service_charge?: number | null
          p_new_billing_frequency?: 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | null
        }
        Returns: {
          new_lease_id: string
          opening_balance: number
          new_start_date: string
          new_end_date: string
        }[]
      }
      void_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

