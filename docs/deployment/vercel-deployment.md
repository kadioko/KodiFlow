# Vercel Deployment Guide

Deploy KodiFlow to Vercel for production use.

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Supabase project (already set up)

## Deployment Steps

### 1. Push Code to GitHub

First, commit and push your code:

```bash
# Add all files
git add .

# Commit
git commit -m "Deploy KodiFlow"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/kodiflow.git
git push -u origin master
```

### 2. Import Project to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### 3. Configure Environment Variables

In Vercel project settings, add these environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_NAME=KodiFlow
NEXT_PUBLIC_DEFAULT_CURRENCY=TZS
```

**Important**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. Vercel automatically handles this.

### 4. Deploy

Click **Deploy**. Vercel will:

1. Install dependencies (`npm install`)
2. Build the project (`npm run build`)
3. Deploy to global CDN

### 5. Update Supabase Auth URLs

After deployment, update Supabase with your production URL:

1. Go to Supabase Dashboard -> Authentication -> URL Configuration
2. Set **Site URL**: `https://your-domain.vercel.app`
3. Add to **Redirect URLs**:

   - `https://your-domain.vercel.app/auth/callback`

### 6. Custom Domain (Optional)

1. In Vercel, go to Project Settings -> Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Supabase Auth URLs with new domain

## Automatic Deployments

Vercel automatically deploys on every push to:

- `main` or `master` branch -> Production
- Other branches -> Preview deployments

## Environment-Specific Configuration

### Production

- Environment: Production
- Database: Supabase Production
- URL: `https://your-domain.com`

### Preview (Staging)

- Environment: Preview
- Database: Can use Supabase (same or separate)
- URL: `https://branch-name-project.vercel.app`

### Local Development

- Environment: Development
- Database: Supabase (usually same as production for small teams)
- URL: `http://localhost:3000`

## Monitoring

### Vercel Analytics

1. Enable in Project Settings -> Analytics
2. View performance metrics
3. Monitor Core Web Vitals

### Error Tracking (Recommended)

Add Sentry integration:

```bash
npm install @sentry/nextjs
```

Configure in `next.config.js` and environment variables.

## Troubleshooting

### Build Errors

- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Run `npm run build` locally to test

### Runtime Errors

- Check function logs in Vercel dashboard
- Verify environment variables are set correctly
- Check Supabase connection
- Redeploy after changing `NEXT_PUBLIC_*` values because they are baked into the frontend build

### 404 Errors

- Ensure `next.config.js` has correct settings
- Check that pages are in correct locations
- Verify middleware isn't blocking requests

### Database Connection Issues

- Verify Supabase URL and keys
- Check if database is paused (free tier)
- Ensure RLS policies allow access

## Performance Optimization

### Vercel Settings

1. Enable **Edge Network**
2. Set **Build Command**: `npm run build`
3. Set **Output Directory**: `.next`
4. Enable **Git LFS** for large files (documents)

### Next.js Optimization

- Use Server Components where possible
- Implement proper image optimization
- Enable static generation for public pages

## Backup & Rollback

### Rollback

Vercel keeps previous deployments:

1. Go to Deployments tab
2. Click on previous deployment
3. Click **Promote to Production**

### Database

Supabase handles backups automatically:

- Daily backups on free tier
- Point-in-time recovery on Pro

## Security Checklist

- [ ] Environment variables not in code
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only on server
- [ ] RLS policies tested on production data
- [ ] Tenant, unit, property, lease, invoice, and payment detail pages tested after deploy
- [ ] Mobile menu, PWA install help, and light/dark mode tested on a phone viewport
- [ ] Custom domain with HTTPS
- [ ] Build logs don't expose secrets

## Cost Estimates

### Vercel Free Tier

- 100GB bandwidth
- 6,000 build minutes/month
- Perfect for MVP and small usage

### Vercel Pro ($20/month)

- 1TB bandwidth
- 14,000 build minutes
- Email support

### Supabase Free Tier

- 500MB database
- 2GB storage
- 2M Edge Function invocations

### Supabase Pro ($25/month)

- 8GB database
- 100GB storage
- Priority support

**Total MVP Cost**: $0-45/month

## Next Steps

1. [Set up monitoring](#monitoring)
2. [Configure custom domain](#6-custom-domain-optional)
3. [Add team members](https://vercel.com/docs/teams)
4. [Review security checklist](#security-checklist)

## Support

- Vercel Docs: <https://vercel.com/docs>
- Next.js on Vercel: <https://nextjs.org/docs/deployment>
- Supabase + Vercel: <https://supabase.com/docs/guides/integrations/vercel>

---

**Last Updated**: May 2026
