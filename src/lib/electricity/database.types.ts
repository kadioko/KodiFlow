import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type CompleteDatabase = Omit<Database, 'public'> & {
  public: {
    Tables: {
      [TableName in keyof Database['public']['Tables']]: Database['public']['Tables'][TableName] extends {
        Row: infer Row
        Insert: infer Insert
        Update: infer Update
      }
        ? { Row: Row; Insert: Insert; Update: Update; Relationships: [] }
        : never
    }
    Views: Database['public']['Views']
    Functions: Database['public']['Functions']
    Enums: Database['public']['Enums']
  }
}

export type ElectricityStaffRow = Database['public']['Tables']['electricity_staff']['Row']
export type ElectricityAccountRow = Database['public']['Tables']['electricity_accounts']['Row']
export type ElectricityReadingRow = Database['public']['Tables']['electricity_readings']['Row']
export type ElectricitySupabaseClient = SupabaseClient<CompleteDatabase>

export function asElectricityClient(client: SupabaseClient): ElectricitySupabaseClient {
  return client as unknown as ElectricitySupabaseClient
}
