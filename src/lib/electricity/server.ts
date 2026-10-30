import { asElectricityClient, type ElectricitySupabaseClient, type ElectricityStaffRow } from '@/lib/electricity/database.types'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/admin'

export type ElectricityActor = {
  client: ElectricitySupabaseClient
  service: ElectricitySupabaseClient
  user: { id: string; email?: string | null }
  ownerUserId: string
  propertyIds: string[]
  staff: ElectricityStaffRow | null
  isOwner: boolean
}

export async function getElectricityActor(): Promise<ElectricityActor | null> {
  const client = asElectricityClient(await createClient())
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null

  const service = asElectricityClient(createServiceClient())
  const { data: staff, error: staffError } = await service
    .from('electricity_staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (staffError) throw staffError

  if (staff) {
    if (!staff.active) return null
    const { data: memberships, error: membershipError } = await service
      .from('electricity_staff_properties')
      .select('property_id')
      .eq('staff_id', staff.id)

    if (membershipError) throw membershipError

    return {
      client,
      service,
      user: { id: user.id, email: user.email },
      ownerUserId: staff.owner_user_id,
      propertyIds: (memberships || []).map((membership) => membership.property_id),
      staff,
      isOwner: false,
    }
  }

  const { data: properties, error: propertyError } = await service
    .from('properties')
    .select('id')
    .eq('user_id', user.id)

  if (propertyError) throw propertyError

  return {
    client,
    service,
    user: { id: user.id, email: user.email },
    ownerUserId: user.id,
    propertyIds: (properties || []).map((property) => property.id),
    staff: null,
    isOwner: true,
  }
}

export function canAccessElectricityProperty(actor: ElectricityActor, propertyId: string) {
  return actor.propertyIds.includes(propertyId)
}

export function normalizeStaffId(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

export function isValidStaffId(value: string) {
  return /^[A-Z0-9._-]{3,24}$/.test(value)
}

export function isValidStaffPin(value: unknown): value is string {
  return typeof value === 'string' && /^\d{8,12}$/.test(value)
}
