# KodiFlow Documentation

Welcome to the KodiFlow documentation. This folder contains comprehensive documentation for developers, users, and deployment.

## Documentation Structure

```
docs/
├── README.md                 # This file
├── architecture/             # System architecture docs
│   ├── database-schema.md
│   ├── tech-stack.md
│   └── security.md
├── api/                      # API documentation
│   ├── supabase-client.md
│   └── database-functions.md
├── deployment/               # Deployment guides
│   ├── vercel-deployment.md
│   ├── supabase-setup.md
│   └── environment-variables.md
├── user-guides/              # End-user documentation
│   ├── getting-started.md
│   ├── managing-properties.md
│   ├── tenant-management.md
│   └── financial-workflows.md
└── development/              # Developer docs
    ├── local-setup.md
    ├── contributing.md
    └── code-style.md
```

## Quick Links

### For Developers
- [Local Setup Guide](development/local-setup.md)
- [Architecture Overview](architecture/tech-stack.md)
- [Database Schema](architecture/database-schema.md)

### For Deployment
- [Vercel Deployment](deployment/vercel-deployment.md)
- [Supabase Setup](deployment/supabase-setup.md)
- [Environment Variables](deployment/environment-variables.md)

### For Users
- [Getting Started](user-guides/getting-started.md)
- [Managing Properties](user-guides/managing-properties.md)

## Project Overview

**KodiFlow** is a modern property management system built for property managers handling residential and commercial rental properties in Tanzania (TZS currency).

### Key Features
- Property, Section, and Unit management
- Tenant management (Individual & Business)
- Lease tracking with automatic status updates
- Invoice generation with multi-line items
- Payment recording and balance tracking
- Financial dashboard with metrics

### Tech Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel (Frontend) + Supabase (Backend)
- **Icons**: Lucide React

## Getting Started

1. Read the [Local Setup Guide](development/local-setup.md)
2. Set up your [Supabase project](deployment/supabase-setup.md)
3. Configure [environment variables](deployment/environment-variables.md)
4. Run the development server

## Support

For issues or questions:
- Check the [ROADMAP.md](../ROADMAP.md) for planned features
- Review [architecture documentation](architecture/)
- Check Supabase and Next.js documentation

## License

MIT License - See main README.md
