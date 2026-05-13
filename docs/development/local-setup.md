# Local Development Setup

Get KodiFlow running on your local machine for development.

## Prerequisites

- Node.js 18+ (Download from [nodejs.org](https://nodejs.org))
- npm (comes with Node.js)
- Git
- A Supabase account (free tier)

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/kodiflow.git
cd kodiflow
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase client libraries
- Lucide icons
- Other dependencies

### 3. Set Up Supabase

Follow the [Supabase Setup Guide](../deployment/supabase-setup.md):

1. Create Supabase project
2. Run the database schema
3. Get your API keys
4. Configure authentication

### 4. Configure Environment Variables

Create `.env.local` file in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
```

**Never commit this file!** It's already in `.gitignore`.

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You should see:
- Landing page at `/`
- Login page at `/auth/login`

### 6. Create First Account

1. Go to `http://localhost:3000/auth/register`
2. Create your admin account
3. Verify email (check Supabase Auth logs if emails not configured)
4. Log in

### 7. Seed Demo Data (Optional)

To test with sample data:

1. Get your user ID from Supabase Auth → Users
2. Edit `supabase/seed.sql`
3. Replace `USER_ID_HERE` with your actual UUID
4. Run in Supabase SQL Editor

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript compiler |

## Development Workflow

### Typical Workflow

1. **Start dev server**: `npm run dev`
2. **Make changes**: Edit files in `src/`
3. **See changes**: Browser auto-refreshes
4. **Check types**: Run `npm run type-check`
5. **Commit**: `git commit -am "Description"`

### Adding New Features

1. Create/edit files in `src/app/`
2. Follow existing patterns
3. Use TypeScript for type safety
4. Test on multiple screen sizes
5. Run `npm run type-check` before committing

### Database Changes

1. Test in Supabase SQL Editor first
2. Document in `docs/database-changes.md`
3. Update seed data if needed
4. Test with fresh database

## Project Structure for Development

```
src/
├── app/                    # Pages (Next.js App Router)
│   ├── page.tsx           # Landing page
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   ├── (auth)/            # Auth routes
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/         # Dashboard
│   ├── properties/        # Property CRUD
│   ├── tenants/           # Tenant management
│   ├── units/             # Unit management
│   ├── leases/            # Lease management
│   ├── invoices/          # Invoices
│   ├── payments/          # Payments
│   └── reports/           # Reports (to build)
├── components/            # Reusable components
│   ├── layout/           # Layout components
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── ui/               # UI components (buttons, inputs)
│   ├── forms/            # Form components
│   └── charts/           # Charts (to build)
├── lib/supabase/         # Supabase setup
├── types/                # TypeScript types
└── utils/                # Utility functions
```

## Common Development Tasks

### Add a New Page

1. Create folder: `src/app/new-page/`
2. Create `page.tsx`:

```tsx
export default function NewPage() {
  return (
    <div>
      <h1>New Page</h1>
    </div>
  )
}
```

3. Access at `http://localhost:3000/new-page`

### Add a New Database Table

1. Write SQL in Supabase SQL Editor
2. Add types to `src/types/index.ts`
3. Add RLS policies
4. Create CRUD functions
5. Build UI for the feature

### Add a New Component

1. Create file in `src/components/`
2. Export component:

```tsx
'use client' // if using client features

export function MyComponent() {
  return <div>Component</div>
}
```

3. Import and use in pages

## Troubleshooting

### Port Already in Use

If port 3000 is taken:

```bash
npm run dev -- --port 3001
```

### Type Errors

Run type checker:
```bash
npm run type-check
```

### Module Not Found

Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Issues

- Check `.env.local` has correct values
- Verify Supabase project is active
- Check RLS policies allow your operations

### Hot Reload Not Working

- Restart dev server: `Ctrl+C`, then `npm run dev`
- Check for syntax errors in console
- Clear browser cache

## Best Practices

### Code Style
- Use TypeScript for everything
- Follow existing file naming conventions
- Use Tailwind utility classes
- Extract reusable components

### Git
- Commit often with descriptive messages
- Create feature branches: `git checkout -b feature/name`
- Pull before pushing to avoid conflicts

### Testing
- Test on mobile viewport
- Test with different users/permissions
- Verify database operations work
- Check console for errors

### Performance
- Use Server Components where possible
- Lazy load heavy components
- Optimize images
- Minimize client-side JavaScript

## VS Code Extensions (Recommended)

- **ESLint**: Linting support
- **Prettier**: Code formatting
- **Tailwind CSS IntelliSense**: Autocomplete classes
- **TypeScript Importer**: Auto-imports
- **GitLens**: Git history

## Getting Help

- Check [ROADMAP.md](../../ROADMAP.md) for planned features
- Review [architecture docs](../architecture/)
- See [Supabase docs](https://supabase.com/docs)
- See [Next.js docs](https://nextjs.org/docs)

## Next Steps

1. [Set up Vercel deployment](../deployment/vercel-deployment.md)
2. Review [contributing guidelines](./contributing.md)
3. Check [user guides](../user-guides/) for feature documentation

---

**Happy Coding!**

**Last Updated**: May 2026
