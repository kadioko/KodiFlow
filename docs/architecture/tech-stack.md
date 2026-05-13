# KodiFlow Architecture - Tech Stack

## Overview

KodiFlow follows a modern serverless architecture with separation between frontend and backend services.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Browser   │  │   Mobile    │  │    PWA      │         │
│  │   (Web)     │  │   (Future)  │  │  (Future)   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                     FRONTEND LAYER                           │
│                    Vercel Edge Network                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Next.js 14 Application                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │  App Router  │  │ Server Comp. │  │ Client Comp. │  │ │
│  │  │   (Pages)    │  │   (Data)     │  │  (Interact)  │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │ │
│  │  ┌──────────────┐  ┌──────────────┐                   │ │
│  │  │ Tailwind CSS │  │  Server Actions                   │ │
│  │  │   (Styles)   │  │   (Mutations)                     │ │
│  │  └──────────────┘  └──────────────┘                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼───────────────────────────────────┐
│                     BACKEND LAYER                            │
│                      Supabase Platform                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │  Properties  │  │   Tenants    │  │    Leases    │ │  │
│  │  │    Units     │  │   Invoices   │  │   Payments   │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Supabase Auth                             │  │
│  │         (JWT + Row Level Security)                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Supabase Storage                          │  │
│  │         (Documents & Receipts)                         │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Technology Choices

### Frontend

#### Next.js 14 (App Router)
- **Why**: Server-side rendering, API routes, file-based routing
- **Benefits**: SEO, performance, simplified data fetching
- **Pattern**: Server Components for data, Client Components for interactivity

#### TypeScript
- **Why**: Type safety, better IDE support, fewer runtime errors
- **Strict Mode**: Enabled for maximum safety

#### Tailwind CSS
- **Why**: Utility-first, rapid development, consistent design
- **Custom Config**: Extended with brand colors (primary, success, warning, danger)

#### Lucide React
- **Why**: Clean, consistent icon set
- **Tree-shaking**: Only used icons are bundled

### Backend

#### Supabase (Managed PostgreSQL)
- **Why**: Open source, PostgreSQL power, generous free tier
- **Features Used**:
  - Database with RLS
  - Authentication
  - Storage (for documents)
  - Realtime (future use)

#### PostgreSQL
- **Why**: Relational data with complex relationships
- **Features**:
  - Triggers for automation
  - Foreign keys for integrity
  - JSONB for flexibility (if needed)
  - Full-text search (future)

#### Row Level Security (RLS)
- **Why**: Security at database level
- **Pattern**: Every table has `user_id` and RLS policies
- **Benefit**: Users can only access their own data

## Data Flow

### 1. Authentication Flow
```
User → Login Form → Supabase Auth → JWT Token → Cookie
```

### 2. Data Fetching Flow (Server Component)
```
Page Load → Server Component → Supabase Client → Database
                ↓
           Render HTML → Send to Browser
```

### 3. Mutation Flow (Server Action)
```
Form Submit → Server Action → Supabase Client → Database
                ↓
         Revalidate → Refresh Page
```

### 4. Real-time Updates (Future)
```
Database Change → Supabase Realtime → Browser (WebSocket)
```

## File Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth group (login, register)
│   ├── dashboard/         # Dashboard layout + page
│   ├── properties/        # Property pages
│   ├── tenants/           # Tenant pages
│   ├── units/             # Unit pages
│   ├── leases/            # Lease pages
│   ├── invoices/          # Invoice pages
│   ├── payments/          # Payment pages
│   └── api/               # API routes (if needed)
├── components/
│   ├── layout/            # Layout components
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── ui/                # Reusable UI components
│   ├── forms/             # Form components
│   └── charts/            # Chart components
├── lib/
│   └── supabase/          # Supabase clients
│       ├── client.ts      # Browser client
│       ├── server.ts      # Server client
│       ├── middleware.ts  # Auth middleware
│       └── database.types.ts  # Generated types
├── types/
│   └── index.ts           # Application types
└── utils/
    ├── constants.ts       # App constants
    └── currency.ts        # Currency formatting
```

## Security Architecture

### Authentication
- JWT-based authentication via Supabase Auth
- HTTP-only cookies for session management
- Automatic session refresh via middleware

### Authorization
- Row Level Security (RLS) at database level
- Every table filtered by `auth.uid() = user_id`
- No application-level authorization needed

### Data Protection
- Environment variables for secrets
- No sensitive data in client-side code
- Prepared statements (via Supabase client)
- Input validation on both client and server

## Performance Considerations

### Frontend
- Server Components reduce JavaScript bundle
- Image optimization via Next.js
- CSS purging via Tailwind
- Code splitting by route

### Backend
- Database indexes on frequently queried columns
- Connection pooling via Supabase
- Efficient queries with joins
- Pagination for large lists

### Caching Strategy
- Static pages: Full caching
- Dynamic pages: Stale-while-revalidate
- API responses: Cache headers
- Database: Query result caching (future)

## Scalability

### Current (MVP)
- Vercel Hobby plan
- Supabase Free tier
- Suitable for: 1-10 property managers, 100 properties

### Future Growth
- Vercel Pro plan for more bandwidth
- Supabase Pro for more database connections
- Add Redis for caching (if needed)
- CDN for static assets

## Monitoring & Logging

### To Be Implemented
- Error tracking (Sentry)
- Performance monitoring (Vercel Analytics)
- Database monitoring (Supabase Dashboard)
- Uptime monitoring

## Backup & Recovery

### Automated (Supabase)
- Daily database backups
- Point-in-time recovery (Pro plan)
- Document storage backups

### Manual
- Database schema in version control
- Seed data for development
- Environment variable backups

## Development Workflow

1. **Local Development**
   - Next.js dev server
   - Local Supabase or cloud
   - Hot reload

2. **Testing**
   - Type checking: `npm run type-check`
   - Linting: `npm run lint`

3. **Deployment**
   - Push to GitHub
   - GitHub Actions runs checks
   - Auto-deploy to Vercel

4. **Database Changes**
   - Schema changes via SQL Editor
   - Documented in migrations
   - Seed data for development

## Technology Trade-offs

### Chosen
| Decision | Reason |
|----------|--------|
| Next.js over CRA | SSR, file routing, API routes |
| Supabase over Firebase | SQL, RLS, open source |
| Tailwind over CSS-in-JS | Performance, consistency |
| Server Components | Reduced bundle, better SEO |

### Not Chosen (Future Considerations)
| Technology | Why Not Now | When |
|------------|-------------|------|
| tRPC | Overkill for current needs | Complex APIs |
| Prisma | Supabase client sufficient | Complex migrations |
| Redux | Server state management | Offline support |
| React Query | Server Components handle it | Client-heavy features |

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Last Updated**: May 2026
