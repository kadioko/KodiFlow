# KodiFlow - Property Management System

A modern, full-stack property management web application for managing residential and commercial rental properties.

## Features

### Property Management

- **Multiple Property Types**: Support for residential, commercial, and mixed-use properties
- **Flexible Structure**: Property → Sections → Units hierarchical organization
- **Section Types**: Floors, blocks, wings, areas, compounds, market zones, parking areas
- **Unit Types**: Apartments, rooms, houses, shops, offices, stalls, kiosks, warehouses, godowns, parking slots

### Tenant Management

- **Tenant Types**: Individual, business, and organization tenants
- **Commercial Features**: Business name, TIN, business license, contact person
- **Residential Features**: Full name, ID number, emergency contact
- **Tenant Portal**: View all tenant information in one place

### Lease Management

- **Flexible Leases**: Residential and commercial lease types
- **Billing Options**: Monthly, quarterly, and annual billing
- **Rent Escalation**: Automatic rent increase with percentage or fixed amount
- **Status Tracking**: Active, expired, terminated, renewed, pending leases
- **Overlap Prevention**: Database constraints prevent overlapping active leases

### Financial Management

- **Invoice System**: Multi-line item invoices with automatic status tracking
- **Charge Types**: Rent, service charge, security, water, electricity, garbage, maintenance, parking, tax, penalty
- **Payment Recording**: Full and partial payment support
- **Expense Tracking**: Track property expenses by category
- **Currency**: TZS (Tanzanian Shilling) as default, configurable

### Dashboard & Reports

- **Key Metrics**: Expected revenue, collected amount, outstanding balance, overdue tenants
- **Occupancy Tracking**: Vacant vs occupied unit statistics
- **Dashboard Property Controls**: Show or hide property cards from the dashboard view
- **Lease Alerts**: Notifications for leases ending within 30/60/90 days
- **Financial Reports**: Monthly collection, property income, expense reports

### Security

- **Authentication**: Supabase Auth with email/password
- **Row Level Security**: Users can only access their own data
- **Data Validation**: Server-side validation for all financial operations

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)
- Supabase CLI for project linking and schema management

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project on [Supabase](https://supabase.com)
2. Install and link the Supabase CLI by following [docs/deployment/supabase-cli.md](docs/deployment/supabase-cli.md)
3. Apply `supabase/schema.sql` to the project
4. Go to Project Settings → API and copy:
   - Project URL (for `NEXT_PUBLIC_SUPABASE_URL`)
   - `anon` public key (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Seed Demo Data (Optional)

After creating an account:

1. Get your user ID from Supabase Auth
2. Replace `USER_ID_HERE` in `supabase/seed.sql` with your actual user ID
3. Run the seed SQL in Supabase SQL Editor

## Database Schema

### Core Tables

1. **profiles** - User profile information
2. **properties** - Property details (residential/commercial/mixed)
3. **property_sections** - Sections within properties (floors, blocks, etc.)
4. **units** - Individual units/spaces
5. **tenants** - Tenant information
6. **leases** - Lease agreements linking tenants to units
7. **charges** - Additional recurring charges for leases
8. **rent_invoices** - Monthly/quarterly/annual invoices
9. **invoice_items** - Individual line items on invoices
10. **payments** - Payment records
11. **expenses** - Property expenses
12. **documents** - File storage for leases, IDs, receipts

### Key Features

- **Triggers**: Automatic invoice number generation, unit status updates, overlapping lease prevention
- **Indexes**: Optimized queries for dashboard and reports
- **RLS Policies**: All tables have Row Level Security enabled

## Project Structure

```text
kodiflow/
├── src/
│   ├── app/
│   │   ├── auth/           # Authentication pages
│   │   ├── dashboard/      # Main dashboard
│   │   ├── properties/     # Property management
│   │   ├── tenants/        # Tenant management
│   │   ├── units/          # Unit management
│   │   ├── leases/         # Lease management
│   │   ├── invoices/       # Invoice management
│   │   ├── payments/       # Payment recording
│   │   └── reports/        # Reports
│   ├── components/
│   │   ├── dashboard/      # Dashboard client widgets
│   │   └── layout/         # Layout components (Sidebar, Header)
│   ├── lib/
│   │   └── supabase/       # Supabase client setup
│   ├── types/
│   │   └── index.ts        # TypeScript types
│   └── utils/
│       ├── constants.ts    # Application constants
│       └── currency.ts     # Currency formatting
├── supabase/
│   ├── schema.sql          # Database schema
│   └── seed.sql            # Demo data
├── docs/                   # Maintained setup, deployment, and architecture docs
└── README.md
```

## Key Pages

| Page | Description |
| ---- | ----------- |
| `/dashboard` | Main dashboard with metrics and alerts |
| `/properties` | List of all properties |
| `/properties/new` | Create new property |
| `/tenants` | Tenant management |
| `/units` | Unit/space management |
| `/units/[id]` | Unit details and related leases/invoices/payments |
| `/units/[id]/edit` | Edit unit details |
| `/leases` | Lease agreements |
| `/leases/[id]` | Lease details and lease actions |
| `/invoices` | Invoice management |
| `/invoices/[id]` | Invoice details, line items, and payments |
| `/payments` | Payment recording |
| `/reports` | Financial reports |

## Default Credentials

When you seed the database, demo accounts are created. You can log in with:

- Email: (your account email)
- Password: (your account password)

## Customization

### Changing Currency

1. Update `NEXT_PUBLIC_DEFAULT_CURRENCY` in `.env.local`
2. Update the currency formatting in `src/utils/currency.ts`

### Adding New Unit Types

Edit `UNIT_TYPES` in `src/utils/constants.ts`:

```typescript
export const UNIT_TYPES = [
  // ... existing types
  { value: 'storage', label: 'Storage Unit', usage: 'commercial' },
] as const;
```

## Deployment

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Make sure to add your environment variables in the Vercel dashboard.

See [docs/deployment/vercel-deployment.md](docs/deployment/vercel-deployment.md) for the maintained deployment guide.

## License

MIT License - feel free to use for commercial or personal projects.

## Support

For issues or questions:

1. Check the [Supabase documentation](https://supabase.com/docs)
2. Check the [Next.js documentation](https://nextjs.org/docs)

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Tenant portal for online payments
- [ ] Multi-currency support
- [ ] Advanced reporting with charts
- [ ] SMS notifications
- [ ] Document templates
- [ ] Lease renewal automation
