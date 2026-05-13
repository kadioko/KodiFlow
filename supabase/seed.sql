-- KodiFlow Seed Data
-- Run this after setting up the schema to populate with demo data

-- Note: This seed data should be run after a user is created via Supabase Auth
-- Replace 'USER_ID_HERE' with the actual user UUID from auth.users

-- ============================================
-- DEMO PROPERTIES
-- ============================================

-- 1. Residential Property: Mbezi Apartments
INSERT INTO properties (id, user_id, name, property_type, location, description)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', 'Mbezi Apartments', 'residential', 'Mbezi Beach, Dar es Salaam', 'Modern residential apartment complex near the beach');

-- 2. Commercial Property: Kariakoo Plaza
INSERT INTO properties (id, user_id, name, property_type, location, description)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', 'Kariakoo Plaza', 'commercial', 'Kariakoo Market Area, Dar es Salaam', 'Commercial shopping plaza with retail spaces and offices');

-- 3. Mixed-Use Property: Main Street Building
INSERT INTO properties (id, user_id, name, property_type, location, description)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', 'Main Street Building', 'mixed_use', 'City Center, Dar es Salaam', 'Mixed-use building with ground floor shops and upper floor apartments');

-- ============================================
-- PROPERTY SECTIONS
-- ============================================

-- Mbezi Apartments Sections
INSERT INTO property_sections (id, user_id, property_id, name, section_type, description)
VALUES 
  ('660e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', 'Block A', 'block', 'Main residential block facing the ocean'),
  ('660e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', 'Block B', 'block', 'Secondary residential block');

-- Kariakoo Plaza Sections
INSERT INTO property_sections (id, user_id, property_id, name, section_type, description)
VALUES 
  ('660e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', 'Ground Floor', 'floor', 'Ground floor retail shops'),
  ('660e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', 'First Floor', 'floor', 'First floor retail and office spaces'),
  ('660e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', 'Outside Kiosks', 'market_zone', 'Open air kiosk spaces'),
  ('660e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', 'Parking Area', 'parking_area', 'Commercial parking slots');

-- Main Street Building Sections
INSERT INTO property_sections (id, user_id, property_id, name, section_type, description)
VALUES 
  ('660e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440002', 'Ground Floor Commercial', 'floor', 'Ground floor shops and retail'),
  ('660e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440002', 'Upper Floor Residential', 'floor', 'Upper floor apartments');

-- ============================================
-- UNITS
-- ============================================

-- Mbezi Apartments - Block A Units
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'A1', 'apartment', 'residential', 800000, 85, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'A2', 'apartment', 'residential', 750000, 80, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'A3', 'apartment', 'residential', 700000, 75, 'vacant');

-- Mbezi Apartments - Block B Units
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'B1', 'apartment', 'residential', 650000, 70, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'B2', 'apartment', 'residential', 600000, 65, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'B3', 'apartment', 'residential', 550000, 60, 'vacant');

-- Kariakoo Plaza - Ground Floor Shops
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', 'Shop G01', 'shop', 'commercial', 1200000, 45, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', 'Shop G02', 'shop', 'commercial', 1100000, 40, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440008', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', 'Shop G03', 'shop', 'commercial', 1000000, 38, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440009', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', 'Shop G04', 'shop', 'commercial', 950000, 35, 'vacant');

-- Kariakoo Plaza - First Floor Offices
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440010', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 'Office F01', 'office', 'commercial', 1500000, 60, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440011', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 'Office F02', 'office', 'commercial', 1400000, 55, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440012', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 'Office F03', 'office', 'commercial', 1300000, 50, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440013', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440003', 'Office F04', 'office', 'commercial', 1200000, 45, 'vacant');

-- Kariakoo Plaza - Kiosks
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440014', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 'Kiosk 1', 'kiosk', 'commercial', 300000, 8, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440015', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 'Kiosk 2', 'kiosk', 'commercial', 300000, 8, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440016', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 'Kiosk 3', 'kiosk', 'commercial', 300000, 8, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440017', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440004', 'Kiosk 4', 'kiosk', 'commercial', 280000, 7, 'vacant');

-- Kariakoo Plaza - Parking
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440018', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440005', 'Parking 1', 'parking_slot', 'commercial', 150000, 15, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440019', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440005', 'Parking 2', 'parking_slot', 'commercial', 150000, 15, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440020', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440005', 'Parking 3', 'parking_slot', 'commercial', 150000, 15, 'vacant'),
  ('770e8400-e29b-41d4-a716-446655440021', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440005', 'Parking 4', 'parking_slot', 'commercial', 150000, 15, 'vacant');

-- Main Street Building - Ground Floor Shops
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440022', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440006', 'Shop 1', 'shop', 'commercial', 2000000, 80, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440023', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440006', 'Shop 2', 'shop', 'commercial', 1800000, 70, 'occupied');

-- Main Street Building - Upper Floor Apartments
INSERT INTO units (id, user_id, property_id, section_id, unit_name, unit_type, usage_type, monthly_rent, size, status)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440024', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440007', 'Apartment 1', 'apartment', 'residential', 900000, 90, 'occupied'),
  ('770e8400-e29b-41d4-a716-446655440025', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440007', 'Apartment 2', 'apartment', 'residential', 850000, 85, 'occupied');

-- ============================================
-- TENANTS
-- ============================================

-- Residential Individual Tenants
INSERT INTO tenants (id, user_id, tenant_type, full_name, phone, email, id_number, emergency_contact_name, emergency_contact_phone, address)
VALUES 
  ('880e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', 'individual', 'John Mwakalinga', '+255713123456', 'john.m@email.com', '1985123456789', 'Jane Mwakalinga', '+255713987654', 'Sinza, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', 'individual', 'Mary Juma', '+255714234567', 'mary.j@email.com', '1990234567890', 'Peter Juma', '+255714876543', 'Mikocheni, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', 'individual', 'David Moshi', '+255715345678', 'david.m@email.com', '1988345678901', 'Grace Moshi', '+255715765432', 'Oyster Bay, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', 'individual', 'Sarah Kimaro', '+255716456789', 'sarah.k@email.com', '1991456789012', 'Michael Kimaro', '+255716654321', 'Masaki, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', 'individual', 'James Mushi', '+255717567890', 'james.m@email.com', '1982567890123', 'Anna Mushi', '+255717543210', 'Upanga, Dar es Salaam');

-- Commercial Business Tenants
INSERT INTO tenants (id, user_id, tenant_type, business_name, contact_person_name, phone, email, tin_number, business_license_number, address)
VALUES 
  ('880e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', 'business', 'Mikoa General Store', 'Robert Chenje', '+255718678901', 'info@mikoastore.co.tz', '123-456-789', 'BLS123456', 'Kariakoo, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', 'business', 'Swahili Fashion House', 'Amina Hassan', '+255719789012', 'contact@swahilifashion.co.tz', '234-567-890', 'BLS234567', 'Kariakoo, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', 'business', 'Tech Solutions TZ Ltd', 'Emmanuel Joseph', '+255720890123', 'info@techsolutions.co.tz', '345-678-901', 'BLS345678', 'City Center, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440008', 'USER_ID_HERE', 'business', 'Safari Logistics', 'Grace Martin', '+255721901234', 'bookings@safarilogistics.co.tz', '456-789-012', 'BLS456789', 'City Center, Dar es Salaam'),
  ('880e8400-e29b-41d4-a716-446655440009', 'USER_ID_HERE', 'business', 'Ngorongoro Crafts', 'Peter Lobulu', '+255722012345', 'sales@ngorongorocrafts.co.tz', '567-890-123', 'BLS567890', 'Kariakoo, Dar es Salaam');

-- ============================================
-- LEASES
-- ============================================

-- Mbezi Apartments Leases (Residential)
INSERT INTO leases (id, user_id, tenant_id, unit_id, property_id, start_date, end_date, monthly_rent, deposit_amount, rent_due_day, lease_type, billing_frequency, status)
VALUES 
  ('990e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '2024-01-01', '2024-12-31', 800000, 1600000, 5, 'residential', 'monthly', 'active'),
  ('990e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '2024-02-01', '2025-01-31', 750000, 1500000, 5, 'residential', 'monthly', 'active'),
  ('990e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', '2024-01-15', '2024-07-15', 650000, 1300000, 5, 'residential', 'monthly', 'active'),
  ('990e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', '2024-03-01', '2025-02-28', 600000, 1200000, 5, 'residential', 'monthly', 'active');

-- Kariakoo Plaza Leases (Commercial)
INSERT INTO leases (id, user_id, tenant_id, unit_id, property_id, start_date, end_date, monthly_rent, deposit_amount, rent_due_day, lease_type, billing_frequency, rent_escalation_type, rent_escalation_value, rent_escalation_frequency, status)
VALUES 
  ('990e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', '2024-01-01', '2025-12-31', 1200000, 2400000, 1, 'commercial', 'monthly', 'percentage', 5, 'annually', 'active'),
  ('990e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', '2024-02-01', '2026-01-31', 1100000, 2200000, 1, 'commercial', 'monthly', 'percentage', 5, 'annually', 'active'),
  ('990e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', '2024-01-01', '2025-12-31', 1000000, 2000000, 1, 'commercial', 'monthly', 'percentage', 5, 'annually', 'active'),
  ('990e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', '2024-03-01', '2026-02-28', 1500000, 3000000, 1, 'commercial', 'monthly', 'percentage', 5, 'annually', 'active'),
  ('990e8400-e29b-41d4-a716-446655440008', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', '2024-01-01', '2025-12-31', 1400000, 2800000, 1, 'commercial', 'monthly', 'percentage', 5, 'annually', 'active'),
  ('990e8400-e29b-41d4-a716-446655440009', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440001', '2024-01-01', '2024-12-31', 300000, 600000, 1, 'commercial', 'monthly', 'none', 0, 'none', 'active'),
  ('990e8400-e29b-41d4-a716-446655440010', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440001', '2024-02-01', '2025-01-31', 300000, 600000, 1, 'commercial', 'monthly', 'none', 0, 'none', 'active'),
  ('990e8400-e29b-41d4-a716-446655440011', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440001', '2024-01-01', '2024-12-31', 300000, 600000, 1, 'commercial', 'monthly', 'none', 0, 'none', 'active'),
  ('990e8400-e29b-41d4-a716-446655440012', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440018', '550e8400-e29b-41d4-a716-446655440001', '2024-01-01', '2025-12-31', 150000, 300000, 1, 'commercial', 'monthly', 'none', 0, 'none', 'active'),
  ('990e8400-e29b-41d4-a716-446655440013', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440001', '2024-03-01', '2026-02-28', 150000, 300000, 1, 'commercial', 'monthly', 'none', 0, 'none', 'active');

-- Main Street Building Leases (Mixed Use)
INSERT INTO leases (id, user_id, tenant_id, unit_id, property_id, start_date, end_date, monthly_rent, deposit_amount, rent_due_day, lease_type, billing_frequency, status)
VALUES 
  ('990e8400-e29b-41d4-a716-446655440014', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440002', '2024-01-01', '2025-12-31', 2000000, 4000000, 1, 'commercial', 'monthly', 'active'),
  ('990e8400-e29b-41d4-a716-446655440015', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440002', '2024-02-01', '2026-01-31', 1800000, 3600000, 1, 'commercial', 'monthly', 'active'),
  ('990e8400-e29b-41d4-a716-446655440016', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440024', '550e8400-e29b-41d4-a716-446655440002', '2024-01-01', '2024-12-31', 900000, 1800000, 5, 'residential', 'monthly', 'active'),
  ('990e8400-e29b-41d4-a716-446655440017', 'USER_ID_HERE', '880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440025', '550e8400-e29b-41d4-a716-446655440002', '2024-03-01', '2025-02-28', 850000, 1700000, 5, 'residential', 'monthly', 'active');

-- ============================================
-- CHARGES (for commercial leases)
-- ============================================

-- Commercial Lease Additional Charges
INSERT INTO charges (id, user_id, lease_id, charge_name, charge_type, amount, frequency, is_active)
VALUES 
  -- Mikoa General Store (Shop G01)
  ('aa0e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440004', 'Service Charge', 'service_charge', 150000, 'monthly', true),
  ('aa0e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440004', 'Security Fee', 'security', 50000, 'monthly', true),
  ('aa0e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440004', 'Garbage Collection', 'garbage', 30000, 'monthly', true),

  -- Swahili Fashion House (Shop G02)
  ('aa0e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440005', 'Service Charge', 'service_charge', 140000, 'monthly', true),
  ('aa0e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440005', 'Security Fee', 'security', 50000, 'monthly', true),

  -- Tech Solutions (Office F01)
  ('aa0e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440007', 'Service Charge', 'service_charge', 200000, 'monthly', true),
  ('aa0e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440007', 'Parking Fee', 'parking', 100000, 'monthly', true),

  -- Safari Logistics (Office F02)
  ('aa0e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440008', 'Service Charge', 'service_charge', 180000, 'monthly', true),
  ('aa0e8400-e29b-41d4-a716-446655440008', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440008', 'Parking Fee', 'parking', 100000, 'monthly', true),

  -- Main Street Building - Shop 1
  ('aa0e8400-e29b-41d4-a716-446655440009', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440014', 'Service Charge', 'service_charge', 250000, 'monthly', true),
  ('aa0e8400-e29b-41d4-a716-446655440010', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440014', 'Maintenance', 'maintenance', 100000, 'monthly', true),

  -- Main Street Building - Shop 2
  ('aa0e8400-e29b-41d4-a716-446655440011', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440015', 'Service Charge', 'service_charge', 220000, 'monthly', true);

-- ============================================
-- INVOICES (Sample data for May 2024)
-- ============================================

-- Residential Invoices (Paid)
INSERT INTO rent_invoices (id, user_id, lease_id, tenant_id, unit_id, property_id, billing_period_start, billing_period_end, billing_month, billing_year, subtotal, amount_paid, due_date, status)
VALUES 
  ('bb0e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '2024-05-01', '2024-05-31', 5, 2024, 800000, 800000, '2024-05-05', 'paid'),
  ('bb0e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '2024-05-01', '2024-05-31', 5, 2024, 750000, 750000, '2024-05-05', 'paid'),
  ('bb0e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', '2024-05-01', '2024-05-31', 5, 2024, 600000, 600000, '2024-05-05', 'paid');

-- Residential Invoices (Partially Paid)
INSERT INTO rent_invoices (id, user_id, lease_id, tenant_id, unit_id, property_id, billing_period_start, billing_period_end, billing_month, billing_year, subtotal, amount_paid, due_date, status)
VALUES 
  ('bb0e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', '2024-05-01', '2024-05-31', 5, 2024, 650000, 300000, '2024-05-05', 'partially_paid');

-- Commercial Invoices (Paid)
INSERT INTO rent_invoices (id, user_id, lease_id, tenant_id, unit_id, property_id, billing_period_start, billing_period_end, billing_month, billing_year, subtotal, amount_paid, due_date, status)
VALUES 
  ('bb0e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', '2024-05-01', '2024-05-31', 5, 2024, 1470000, 1470000, '2024-05-01', 'paid'),
  ('bb0e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440006', '880e8400-e29b-41d4-a716-446655440009', '770e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', '2024-05-01', '2024-05-31', 5, 2024, 1000000, 1000000, '2024-05-01', 'paid'),
  ('bb0e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440008', '880e8400-e29b-41d4-a716-446655440008', '770e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', '2024-05-01', '2024-05-31', 5, 2024, 1680000, 1680000, '2024-05-01', 'paid');

-- Commercial Invoices (Overdue)
INSERT INTO rent_invoices (id, user_id, lease_id, tenant_id, unit_id, property_id, billing_period_start, billing_period_end, billing_month, billing_year, subtotal, amount_paid, due_date, status)
VALUES 
  ('bb0e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440005', '880e8400-e29b-41d4-a716-446655440006', '770e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', '2024-05-01', '2024-05-31', 5, 2024, 1290000, 0, '2024-05-01', 'overdue'),
  ('bb0e8400-e29b-41d4-a716-446655440008', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440007', '880e8400-e29b-41d4-a716-446655440007', '770e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', '2024-05-01', '2024-05-31', 5, 2024, 1800000, 0, '2024-05-01', 'overdue');

-- Mixed Use Invoices
INSERT INTO rent_invoices (id, user_id, lease_id, tenant_id, unit_id, property_id, billing_period_start, billing_period_end, billing_month, billing_year, subtotal, amount_paid, due_date, status)
VALUES 
  ('bb0e8400-e29b-41d4-a716-446655440009', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440014', '880e8400-e29b-41d4-a716-446655440005', '770e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440002', '2024-05-01', '2024-05-31', 5, 2024, 2350000, 2350000, '2024-05-01', 'paid'),
  ('bb0e8400-e29b-41d4-a716-446655440010', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440016', '880e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440024', '550e8400-e29b-41d4-a716-446655440002', '2024-05-01', '2024-05-31', 5, 2024, 900000, 900000, '2024-05-05', 'paid'),
  ('bb0e8400-e29b-41d4-a716-446655440011', 'USER_ID_HERE', '990e8400-e29b-41d4-a716-446655440017', '880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440025', '550e8400-e29b-41d4-a716-446655440002', '2024-05-01', '2024-05-31', 5, 2024, 850000, 0, '2024-05-05', 'overdue');

-- ============================================
-- INVOICE ITEMS
-- ============================================

-- Residential Invoice Items
INSERT INTO invoice_items (id, user_id, invoice_id, item_name, item_type, amount)
VALUES 
  ('cc0e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440000', 'Monthly Rent - May 2024', 'rent', 800000),
  ('cc0e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440001', 'Monthly Rent - May 2024', 'rent', 750000),
  ('cc0e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440002', 'Monthly Rent - May 2024', 'rent', 600000),
  ('cc0e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440003', 'Monthly Rent - May 2024', 'rent', 650000);

-- Commercial Invoice Items (with charges)
INSERT INTO invoice_items (id, user_id, invoice_id, item_name, item_type, amount)
VALUES 
  -- Mikoa General Store
  ('cc0e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440004', 'Base Rent - May 2024', 'rent', 1200000),
  ('cc0e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440004', 'Service Charge', 'service_charge', 150000),
  ('cc0e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440004', 'Security Fee', 'security', 50000),
  ('cc0e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440004', 'Garbage Collection', 'garbage', 30000),

  -- Swahili Fashion (Overdue)
  ('cc0e8400-e29b-41d4-a716-446655440008', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440007', 'Base Rent - May 2024', 'rent', 1100000),
  ('cc0e8400-e29b-41d4-a716-446655440009', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440007', 'Service Charge', 'service_charge', 140000),
  ('cc0e8400-e29b-41d4-a716-446655440010', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440007', 'Security Fee', 'security', 50000),

  -- Tech Solutions (Overdue)
  ('cc0e8400-e29b-41d4-a716-446655440011', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440008', 'Base Rent - May 2024', 'rent', 1500000),
  ('cc0e8400-e29b-41d4-a716-446655440012', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440008', 'Service Charge', 'service_charge', 200000),
  ('cc0e8400-e29b-41d4-a716-446655440013', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440008', 'Parking Fee', 'parking', 100000),

  -- Safari Logistics
  ('cc0e8400-e29b-41d4-a716-446655440014', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440006', 'Base Rent - May 2024', 'rent', 1400000),
  ('cc0e8400-e29b-41d4-a716-446655440015', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440006', 'Service Charge', 'service_charge', 180000),
  ('cc0e8400-e29b-41d4-a716-446655440016', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440006', 'Parking Fee', 'parking', 100000);

-- Mixed Use Invoice Items
INSERT INTO invoice_items (id, user_id, invoice_id, item_name, item_type, amount)
VALUES 
  -- Main Street Shop 1
  ('cc0e8400-e29b-41d4-a716-446655440017', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440009', 'Base Rent - May 2024', 'rent', 2000000),
  ('cc0e8400-e29b-41d4-a716-446655440018', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440009', 'Service Charge', 'service_charge', 250000),
  ('cc0e8400-e29b-41d4-a716-446655440019', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440009', 'Maintenance', 'maintenance', 100000),

  -- Main Street Apartment 1
  ('cc0e8400-e29b-41d4-a716-446655440020', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440010', 'Monthly Rent - May 2024', 'rent', 900000),

  -- Main Street Apartment 2 (Overdue)
  ('cc0e8400-e29b-41d4-a716-446655440021', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440011', 'Monthly Rent - May 2024', 'rent', 850000);

-- ============================================
-- PAYMENTS
-- ============================================

-- Paid Invoices Payments
INSERT INTO payments (id, user_id, invoice_id, tenant_id, lease_id, property_id, unit_id, amount, payment_date, payment_method, reference)
VALUES 
  -- John Mwakalinga (Paid in full)
  ('dd0e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', 800000, '2024-05-03', 'mobile_money', 'MPESA123456'),
  
  -- Mary Juma (Paid in full)
  ('dd0e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440001', 750000, '2024-05-04', 'bank', 'BANK234567'),

  -- Sarah Kimaro (Paid in full)
  ('dd0e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440003', '990e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440004', 600000, '2024-05-02', 'cash', 'CASH001'),

  -- David Moshi (Partial payment)
  ('dd0e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440003', 300000, '2024-05-10', 'mobile_money', 'MPESA654321'),

  -- Mikoa General Store (Paid)
  ('dd0e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440005', '990e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440006', 1470000, '2024-05-01', 'bank', 'BANK789012'),

  -- Safari Logistics (Paid)
  ('dd0e8400-e29b-41d4-a716-446655440005', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440006', '880e8400-e29b-41d4-a716-446655440008', '990e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440011', 1680000, '2024-05-01', 'bank', 'BANK890123'),

  -- Main Street Shop 1 (Paid)
  ('dd0e8400-e29b-41d4-a716-446655440006', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440009', '880e8400-e29b-41d4-a716-446655440005', '990e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440022', 2350000, '2024-05-01', 'cheque', 'CHQ001'),

  -- Main Street Apartment 1 (Paid)
  ('dd0e8400-e29b-41d4-a716-446655440007', 'USER_ID_HERE', 'bb0e8400-e29b-41d4-a716-446655440010', '880e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440024', 900000, '2024-05-03', 'mobile_money', 'MPESA789456');

-- ============================================
-- EXPENSES
-- ============================================

INSERT INTO expenses (id, user_id, property_id, section_id, unit_id, category, amount, expense_date, vendor, description)
VALUES 
  ('ee0e8400-e29b-41d4-a716-446655440000', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', null, null, 'Maintenance', 500000, '2024-05-10', 'ABC Repairs', 'General building maintenance'),
  ('ee0e8400-e29b-41d4-a716-446655440001', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', null, 'Security', 200000, '2024-05-01', 'Secure Guard Co', 'Monthly security service'),
  ('ee0e8400-e29b-41d4-a716-446655440002', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', null, null, 'Electricity', 800000, '2024-05-05', 'Tanesco', 'Monthly electricity bill'),
  ('ee0e8400-e29b-41d4-a716-446655440003', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440001', null, null, 'Water', 150000, '2024-05-05', 'DAWASA', 'Monthly water bill'),
  ('ee0e8400-e29b-41d4-a716-446655440004', 'USER_ID_HERE', '550e8400-e29b-41d4-a716-446655440002', null, null, 'Cleaning', 300000, '2024-05-15', 'CleanPro Services', 'Building cleaning services');
