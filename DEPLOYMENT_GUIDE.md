# HostelHub - Deployment Guide

Complete guide for deploying HostelHub to production.

## 📋 Pre-Deployment Checklist

- [ ] All features tested locally
- [ ] Environment variables configured
- [ ] Database schema created
- [ ] Storage buckets configured
- [ ] Images optimized
- [ ] Error handling in place
- [ ] RLS policies enabled
- [ ] Demo data seeded (optional)

## 🚀 Deployment Options

### Option 1: Deploy to Vercel (Recommended)

#### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/hostelhub.git
git push -u origin main
```

#### Step 2: Connect to Vercel
1. Go to https://vercel.com
2. Click "New Project"
3. Select GitHub repository
4. Import project

#### Step 3: Configure Environment Variables
1. Go to Project Settings
2. Click "Environment Variables"
3. Add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   SUPABASE_SERVICE_ROLE_KEY=your_key
   ```

#### Step 4: Deploy
```
Vercel will automatically deploy on push to main
```

### Option 2: Deploy to Railway

#### Step 1: Connect GitHub
1. Go to https://railway.app
2. Click "New Project"
3. Import from GitHub

#### Step 2: Configure
```
Add environment variables
Configure build settings
```

#### Step 3: Deploy
```
Railway deploys automatically
```

### Option 3: Deploy to Self-hosted Server

#### Step 1: Prerequisites
```bash
# Install Node.js
curl https://nodejs.org/dist/v18.0.0/node-v18.0.0-linux-x64.tar.xz | tar xJ

# Install PM2
npm install -g pm2
```

#### Step 2: Clone & Install
```bash
git clone <repo>
cd hostelhub
npm install
npm run build
```

#### Step 3: Configure PM2
```bash
pm2 start npm --name "hostelhub" -- start
pm2 save
pm2 startup
```

#### Step 4: Setup Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Step 5: SSL Certificate
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 🔧 Production Configuration

### Build Optimization
```js
// next.config.js
{
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
}
```

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=production_key
SUPABASE_SERVICE_ROLE_KEY=production_service_role_key
NODE_ENV=production
```

### Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_bills_status_paid ON bills(status) WHERE status = 'pending';
CREATE INDEX idx_room_assignments_active ON room_assignments(status) WHERE status = 'active';
CREATE INDEX idx_hostels_owner ON hostels(owner_id);

-- Enable Connection Pooling in Supabase
-- Go to Supabase → Database → Connection Pool
-- Set pool mode: Transaction
```

### Security Checklist
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] RLS policies active
- [ ] Secrets not in code
- [ ] API keys rotated
- [ ] Database backups enabled
- [ ] WAF enabled (if available)

## 📊 Monitoring & Analytics

### Vercel Analytics
```bash
npm install @vercel/analytics
```

### Add to Root Layout
```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout() {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Monitor Performance
1. Vercel Dashboard
2. Real-time metrics
3. Error tracking
4. Deployment history

## 🗄️ Database Backups

### Supabase Backups
1. Go to Supabase Dashboard
2. Settings → Backups
3. Enable daily backups
4. Download backups regularly

### Manual Backup
```bash
# Export database
pg_dump -U user -d database > backup.sql

# Restore database
psql -U user -d database < backup.sql
```

## 🔄 Continuous Integration/Deployment

### GitHub Actions
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Vercel CLI
        run: npm install -g vercel
      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production
      - name: Build Project Artifacts
        run: vercel build --prod
      - name: Deploy to Vercel
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## 🚨 Troubleshooting Deployment

### Issue: Build Fails
```bash
# Check build logs
vercel logs

# Debug locally
npm run build
npm run start
```

### Issue: Environment Variables Not Working
```bash
# Verify variables are set
echo $NEXT_PUBLIC_SUPABASE_URL

# Restart application
pm2 restart hostelhub
```

### Issue: Database Connection Error
```bash
# Check connection string
SELECT * FROM pg_stat_statements;

# Test connection
psql -h hostname -U user -d database
```

### Issue: Images Not Loading
```
Check storage bucket:
- Bucket permissions (public/private)
- File paths correct
- CORS configured
```

## 📈 Performance Optimization

### Image Optimization
```tsx
import Image from 'next/image';

<Image
  src={url}
  alt="alt"
  width={400}
  height={300}
  priority={false}
  loading="lazy"
/>
```

### Code Splitting
```tsx
import dynamic from 'next/dynamic';

const DynamicComponent = dynamic(() => import('../component'), {
  loading: () => <p>Loading...</p>,
});
```

### Database Query Optimization
```sql
-- Use indexes
EXPLAIN ANALYZE SELECT * FROM bills WHERE student_id = $1;

-- Limit results
SELECT * FROM bills LIMIT 100;

-- Use prepared statements
PREPARE select_bills AS SELECT * FROM bills WHERE student_id = $1;
```

## 🔐 Security Hardening

### Rate Limiting
```tsx
// Use express-rate-limit in API routes
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
```

### HTTPS/TLS
```bash
# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Renew certificate
sudo certbot renew
```

### API Security Headers
```tsx
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  return response;
}
```

## 📝 Post-Deployment

### Checklist
- [ ] Test all features in production
- [ ] Monitor error logs
- [ ] Check database performance
- [ ] Verify backups working
- [ ] Test payment integration
- [ ] Monitor server resources
- [ ] Document configuration
- [ ] Setup alerting

### Monitor Health
```bash
# Check uptime
curl https://yourdomain.com

# Monitor logs
vercel logs --tail

# Check performance
vercel insights
```

## 🆘 Support & Help

### Resources
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs
- Next.js: https://nextjs.org/docs
- GitHub Issues: Create issue for bugs

### Emergency Contact
- Support email: support@hostelhub.com
- Status page: https://status.hostelhub.com

---

## 🎯 Next Steps After Deployment

1. Monitor application health
2. Gather user feedback
3. Optimize based on metrics
4. Plan feature releases
5. Scale infrastructure as needed

**Successfully deployed! 🎉**
