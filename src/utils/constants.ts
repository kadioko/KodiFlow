// Application constants

// Property types
export const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential', color: 'bg-blue-100 text-blue-800' },
  { value: 'commercial', label: 'Commercial', color: 'bg-purple-100 text-purple-800' },
  { value: 'mixed_use', label: 'Mixed Use', color: 'bg-orange-100 text-orange-800' },
] as const;

// Section types
export const SECTION_TYPES = [
  { value: 'floor', label: 'Floor' },
  { value: 'block', label: 'Block' },
  { value: 'wing', label: 'Wing' },
  { value: 'area', label: 'Area' },
  { value: 'compound', label: 'Compound' },
  { value: 'market_zone', label: 'Market Zone' },
  { value: 'parking_area', label: 'Parking Area' },
  { value: 'other', label: 'Other' },
] as const;

// Unit types
export const UNIT_TYPES = [
  { value: 'apartment', label: 'Apartment', usage: 'residential' },
  { value: 'room', label: 'Room', usage: 'residential' },
  { value: 'house', label: 'House', usage: 'residential' },
  { value: 'shop', label: 'Shop', usage: 'commercial' },
  { value: 'office', label: 'Office', usage: 'commercial' },
  { value: 'stall', label: 'Stall', usage: 'commercial' },
  { value: 'kiosk', label: 'Kiosk', usage: 'commercial' },
  { value: 'warehouse', label: 'Warehouse', usage: 'commercial' },
  { value: 'godown', label: 'Godown', usage: 'commercial' },
  { value: 'parking_slot', label: 'Parking Slot', usage: 'commercial' },
  { value: 'land_space', label: 'Land Space', usage: 'commercial' },
  { value: 'other', label: 'Other', usage: 'mixed' },
] as const;

// Usage types
export const USAGE_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed', label: 'Mixed' },
] as const;

// Unit statuses
export const UNIT_STATUSES = [
  { value: 'vacant', label: 'Vacant', color: 'bg-green-100 text-green-800' },
  { value: 'occupied', label: 'Occupied', color: 'bg-blue-100 text-blue-800' },
  { value: 'reserved', label: 'Reserved', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'under_maintenance', label: 'Under Maintenance', color: 'bg-orange-100 text-orange-800' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
] as const;

// Tenant types
export const TENANT_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business' },
  { value: 'organization', label: 'Organization' },
] as const;

// Lease types
export const LEASE_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
] as const;

// Lease statuses
export const LEASE_STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'expired', label: 'Expired', color: 'bg-red-100 text-red-800' },
  { value: 'terminated', label: 'Terminated', color: 'bg-gray-100 text-gray-800' },
  { value: 'renewed', label: 'Renewed', color: 'bg-blue-100 text-blue-800' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
] as const;

// Billing frequencies
export const BILLING_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annually', label: 'Every 6 Months' },
  { value: 'annually', label: 'Annually' },
] as const;

// Charge types
export const CHARGE_TYPES = [
  { value: 'rent', label: 'Rent' },
  { value: 'service_charge', label: 'Service Charge' },
  { value: 'security', label: 'Security' },
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'garbage', label: 'Garbage' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'parking', label: 'Parking' },
  { value: 'tax', label: 'Tax' },
  { value: 'penalty', label: 'Penalty' },
  { value: 'other', label: 'Other' },
] as const;

export const UTILITY_TYPES = [
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili' },
] as const;

// Charge frequencies
export const CHARGE_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
  { value: 'one_time', label: 'One Time' },
  { value: 'custom', label: 'Custom' },
] as const;

// Invoice statuses
export const INVOICE_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'partially_paid', label: 'Partially Paid', color: 'bg-blue-100 text-blue-800' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
] as const;

// Payment methods
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
] as const;

// Document types
export const DOCUMENT_TYPES = [
  { value: 'lease_agreement', label: 'Lease Agreement' },
  { value: 'id_document', label: 'ID Document' },
  { value: 'business_license', label: 'Business License' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'other', label: 'Other' },
] as const;

// Expense categories
export const EXPENSE_CATEGORIES = [
  'Maintenance',
  'Security',
  'Electricity',
  'Water',
  'Cleaning',
  'Repairs',
  'Insurance',
  'Taxes',
  'Legal',
  'Marketing',
  'Other',
] as const;

// Helper functions
export function getLabelByValue(
  constants: readonly { value: string; label: string }[],
  value: string
): string {
  return constants.find((c) => c.value === value)?.label || value;
}

export function getColorByValue(
  constants: readonly { value: string; label: string; color: string }[],
  value: string
): string {
  return constants.find((c) => c.value === value)?.color || 'bg-gray-100 text-gray-800';
}

