# KodiFlow Documentation

KodiFlow is a property management system for residential and commercial rental operations, built with Next.js, TypeScript, Tailwind CSS, Supabase, and Vercel.

## Current Documentation

```text
docs/
|-- README.md
|-- PROJECT_AUDIT.md
|-- architecture/
|   `-- tech-stack.md
|-- deployment/
|   |-- supabase-cli.md
|   |-- supabase-setup.md
|   `-- vercel-deployment.md
|-- development/
|   `-- local-setup.md
`-- user-guides/
    `-- app-user-guide.md
```

## Quick Links

### Product And Architecture

- **Project overview**: [../README.md](../README.md)
- **App user guide**: [user-guides/app-user-guide.md](user-guides/app-user-guide.md)
- **Project audit and improvement backlog**: [PROJECT_AUDIT.md](PROJECT_AUDIT.md)
- **Tech stack**: [architecture/tech-stack.md](architecture/tech-stack.md)
- **Roadmap**: [../ROADMAP.md](../ROADMAP.md)

### Development

- **Local setup**: [development/local-setup.md](development/local-setup.md)
- **Supabase CLI setup**: [deployment/supabase-cli.md](deployment/supabase-cli.md)

### Deployment

- **Supabase setup**: [deployment/supabase-setup.md](deployment/supabase-setup.md)
- **Vercel deployment**: [deployment/vercel-deployment.md](deployment/vercel-deployment.md)

## Current App Coverage

The maintained docs now cover:

- Property, section, unit, tenant, lease, invoice, payment, utility, document, report, search, and settings workflows.
- Mobile navigation through the header menu and desktop navigation through the sidebar.
- PWA installation from Settings, including mobile add-to-home-screen help.
- Light and dark appearance modes.
- Lease editing, lease renewal, unit occupancy links, and tenant/unit/property detail navigation.
- Unit ID/door-number capture and search.
- Monthly, quarterly, six-month, and annual billing frequencies.
- Separate monthly rent and service charge entry, invoice line items, and payment charge breakdowns.

## Documentation Maintenance Rules

- Keep this index aligned with files that actually exist.
- Add new docs only when they contain maintained, actionable information.
- Remove links to deleted or planned-only docs.
- Keep secrets out of documentation and use environment variable names instead.
