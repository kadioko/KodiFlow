// KodiFlow TypeScript Types

// Enums
export type PropertyType = 'residential' | 'commercial' | 'mixed_use';

export type SectionType = 'floor' | 'block' | 'wing' | 'area' | 'compound' | 'market_zone' | 'parking_area' | 'other';

export type UnitType = 'apartment' | 'room' | 'house' | 'shop' | 'office' | 'stall' | 'kiosk' | 'warehouse' | 'godown' | 'parking_slot' | 'land_space' | 'other';

export type UsageType = 'residential' | 'commercial' | 'mixed';

export type UnitStatus = 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive';

export type TenantType = 'individual' | 'business' | 'organization';

export type LeaseType = 'residential' | 'commercial';

export type BillingFrequency = 'monthly' | 'quarterly' | 'annually';

export type LeaseStatus = 'active' | 'expired' | 'terminated' | 'renewed' | 'pending';

export type ChargeType = 'rent' | 'service_charge' | 'security' | 'water' | 'electricity' | 'garbage' | 'maintenance' | 'parking' | 'tax' | 'penalty' | 'other';

export type ChargeFrequency = 'monthly' | 'quarterly' | 'annually' | 'one_time' | 'custom';

export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export type PaymentMethod = 'cash' | 'bank' | 'mobile_money' | 'cheque' | 'card' | 'other';

export type DocumentType = 'lease_agreement' | 'id_document' | 'business_license' | 'receipt' | 'inspection_report' | 'other';

// Database Models
export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  currency_preference: string;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  user_id: string;
  name: string;
  property_type: PropertyType;
  location: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  sections_count?: number;
  units_count?: number;
  occupied_units_count?: number;
  vacant_units_count?: number;
}

export interface PropertySection {
  id: string;
  user_id: string;
  property_id: string;
  name: string;
  section_type: SectionType;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  property_name?: string;
  units_count?: number;
}

export interface Unit {
  id: string;
  user_id: string;
  property_id: string;
  section_id: string | null;
  unit_name: string;
  unit_type: UnitType;
  usage_type: UsageType;
  monthly_rent: number;
  size: number | null;
  size_unit: string;
  status: UnitStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  property_name?: string;
  section_name?: string | null;
  current_lease_id?: string | null;
  current_tenant_id?: string | null;
  current_tenant_name?: string | null;
  lease_end_date?: string | null;
  current_balance?: number;
}

export interface Tenant {
  id: string;
  user_id: string;
  tenant_type: TenantType;
  full_name: string | null;
  business_name: string | null;
  contact_person_name: string | null;
  phone: string;
  email: string | null;
  id_number: string | null;
  tin_number: string | null;
  business_license_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  display_name?: string;
  active_leases_count?: number;
  total_balance?: number;
}

export interface Lease {
  id: string;
  user_id: string;
  tenant_id: string;
  unit_id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number;
  rent_due_day: number;
  lease_type: LeaseType;
  billing_frequency: BillingFrequency;
  rent_escalation_type: 'none' | 'percentage' | 'fixed_amount';
  rent_escalation_value: number | null;
  rent_escalation_frequency: 'none' | 'annually' | 'custom';
  status: LeaseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  tenant_name?: string;
  unit_name?: string;
  property_name?: string;
  days_until_expiry?: number;
  charges?: Charge[];
}

export interface Charge {
  id: string;
  user_id: string;
  lease_id: string;
  charge_name: string;
  charge_type: ChargeType;
  amount: number;
  frequency: ChargeFrequency;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentInvoice {
  id: string;
  user_id: string;
  lease_id: string;
  tenant_id: string;
  unit_id: string;
  property_id: string;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  billing_month: number;
  billing_year: number;
  subtotal: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  tenant_name?: string;
  unit_name?: string;
  property_name?: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  user_id: string;
  invoice_id: string;
  item_name: string;
  item_type: ChargeType;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  invoice_id: string;
  tenant_id: string;
  lease_id: string;
  property_id: string;
  unit_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  tenant_name?: string;
  unit_name?: string;
  property_name?: string;
  invoice_number?: string;
}

export interface Expense {
  id: string;
  user_id: string;
  property_id: string;
  section_id: string | null;
  unit_id: string | null;
  category: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  property_name?: string;
  section_name?: string | null;
  unit_name?: string | null;
}

export interface Document {
  id: string;
  user_id: string;
  property_id: string | null;
  tenant_id: string | null;
  lease_id: string | null;
  unit_id: string | null;
  document_type: DocumentType;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  created_at: string;
  // Joined fields
  property_name?: string | null;
  tenant_name?: string | null;
  unit_name?: string | null;
}

// Dashboard Types
export interface DashboardMetrics {
  totalExpectedThisMonth: number;
  totalCollectedThisMonth: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueTenantsCount: number;
  vacantUnitsCount: number;
  occupiedUnitsCount: number;
  leasesEndingSoonCount: number;
  totalUnitsCount: number;
  totalPropertiesCount: number;
  totalTenantsCount: number;
  // Breakdown by property type
  residential: PropertyTypeMetrics;
  commercial: PropertyTypeMetrics;
  mixed_use: PropertyTypeMetrics;
}

export interface PropertyTypeMetrics {
  expectedThisMonth: number;
  collectedThisMonth: number;
  outstanding: number;
  overdue: number;
  overdueTenantsCount: number;
  vacantUnitsCount: number;
  occupiedUnitsCount: number;
  leasesEndingSoonCount: number;
}

export interface RecentPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  tenant_name: string;
  unit_name: string;
  property_name: string;
}

export interface TopOverdueTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_type: TenantType;
  total_balance: number;
  invoices_count: number;
  phone: string;
}

export interface LeaseEndingSoon {
  lease_id: string;
  tenant_id: string;
  tenant_name: string;
  unit_id: string;
  unit_name: string;
  property_id: string;
  property_name: string;
  end_date: string;
  days_remaining: number;
  monthly_rent: number;
}

// Form Types
export interface PropertyFormData {
  name: string;
  property_type: PropertyType;
  location: string;
  description: string;
}

export interface SectionFormData {
  property_id: string;
  name: string;
  section_type: SectionType;
  description: string;
}

export interface UnitFormData {
  property_id: string;
  section_id: string | null;
  unit_name: string;
  unit_type: UnitType;
  usage_type: UsageType;
  monthly_rent: number;
  size: number | null;
  size_unit: string;
  notes: string;
}

export interface TenantFormData {
  tenant_type: TenantType;
  full_name: string;
  business_name: string;
  contact_person_name: string;
  phone: string;
  email: string;
  id_number: string;
  tin_number: string;
  business_license_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address: string;
  notes: string;
}

export interface LeaseFormData {
  tenant_id: string;
  unit_id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number;
  rent_due_day: number;
  lease_type: LeaseType;
  billing_frequency: BillingFrequency;
  rent_escalation_type: 'none' | 'percentage' | 'fixed_amount';
  rent_escalation_value: number | null;
  rent_escalation_frequency: 'none' | 'annually' | 'custom';
  status: LeaseStatus;
  notes: string;
}

export interface ChargeFormData {
  lease_id: string;
  charge_name: string;
  charge_type: ChargeType;
  amount: number;
  frequency: ChargeFrequency;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string;
}

export interface PaymentFormData {
  invoice_id: string;
  tenant_id: string;
  lease_id: string;
  property_id: string;
  unit_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference: string;
  notes: string;
}

export interface ExpenseFormData {
  property_id: string;
  section_id: string | null;
  unit_id: string | null;
  category: string;
  amount: number;
  expense_date: string;
  vendor: string;
  description: string;
  notes: string;
}

export interface DocumentFormData {
  property_id: string | null;
  tenant_id: string | null;
  lease_id: string | null;
  unit_id: string | null;
  document_type: DocumentType;
  description: string;
  file: File | null;
}

// Filter Types
export interface InvoiceFilters {
  property_id?: string;
  tenant_id?: string;
  unit_id?: string;
  status?: InvoiceStatus;
  month?: number;
  year?: number;
}

export interface PaymentFilters {
  property_id?: string;
  tenant_id?: string;
  unit_id?: string;
  lease_id?: string;
  month?: number;
  year?: number;
  payment_method?: PaymentMethod;
}

export interface UnitFilters {
  property_id?: string;
  section_id?: string;
  usage_type?: UsageType;
  status?: UnitStatus;
  unit_type?: UnitType;
}

export interface TenantFilters {
  tenant_type?: TenantType;
  search?: string;
}

export interface LeaseFilters {
  property_id?: string;
  unit_id?: string;
  tenant_id?: string;
  status?: LeaseStatus;
  lease_type?: LeaseType;
}

// Report Types
export interface MonthlyCollectionReport {
  month: number;
  year: number;
  month_name: string;
  total_invoiced: number;
  total_paid: number;
  total_balance: number;
  collection_rate: number;
}

export interface PropertyIncomeSummary {
  property_id: string;
  property_name: string;
  property_type: PropertyType;
  total_income: number;
  total_expenses: number;
  net_income: number;
}

export interface TenantStatement {
  tenant_id: string;
  tenant_name: string;
  tenant_type: TenantType;
  phone: string;
  invoices: {
    invoice_id: string;
    invoice_number: string;
    billing_period: string;
    due_date: string;
    amount: number;
    paid: number;
    balance: number;
    status: InvoiceStatus;
  }[];
  total_balance: number;
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface ApiListResponse<T> {
  data: T[];
  count: number;
  error: string | null;
}

// Utility Types
export type SelectOption = {
  value: string;
  label: string;
};

export type Currency = 'TZS' | 'USD' | 'EUR' | 'GBP';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  column: string;
  direction: 'asc' | 'desc';
}

// Chart Data Types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}
