# AZLeads CRM - Setup Instructions

## Quick Start

### 1. Database Setup (Supabase)

The database schema is already created in `supabase/migrations/20250930203412_create_initial_schema.sql`.

To add demo data, connect to your Supabase database and run:

```sql
-- Insert admin user (password: admin123)
-- Note: This uses a bcrypt hash. In production, use proper password hashing
INSERT INTO users (email, password_hash, role)
VALUES (
  'admin@azleads.com',
  '$2b$10$rOPZxP8GzL2hTqXkq1K.VO3J5kqNdX1wZrDVvX5C8H8D9iK7.nKB.',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Insert demo affiliate
WITH new_affiliate AS (
  INSERT INTO affiliates (name, email, api_key_hash, ip_whitelist, active)
  VALUES (
    'Demo Affiliate',
    'affiliate@example.com',
    'demo_api_key_123',
    '["0.0.0.0/0"]'::jsonb,
    true
  )
  RETURNING id
),
new_advertiser AS (
  INSERT INTO advertisers (name, endpoint_url, endpoint_secret, platform)
  VALUES (
    'Demo Advertiser',
    'https://example.com/api/leads',
    'secret_123',
    'custom'
  )
  RETURNING id
),
new_offer AS (
  INSERT INTO offers (advertiser_id, name, payout_amount)
  SELECT id, 'Demo Offer', 50.00
  FROM new_advertiser
  RETURNING id, advertiser_id
)
INSERT INTO mappings (affiliate_id, offer_id, advertiser_id, forward_url, enabled)
SELECT
  a.id,
  o.id,
  o.advertiser_id,
  'https://example.com/api/leads',
  true
FROM new_affiliate a, new_offer o;
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at http://localhost:5173

**Login Credentials:**
- Email: admin@azleads.com
- Password: admin123

### 3. Build for Production

```bash
# Build the frontend
npm run build

# Preview the production build
npm run preview
```

## Project Structure

```
/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts (Auth, etc)
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and Supabase client
│   │   └── main.tsx       # Application entry point
│   └── dist/              # Production build output
├── backend/               # Node.js backend (needs completion)
│   └── src/
│       ├── api/           # API routes
│       ├── db/            # Database utilities
│       └── lib/           # Shared utilities
├── supabase/
│   ├── migrations/        # Database migrations
│   └── functions/         # Edge functions
└── dist/                  # Built frontend (from root)
```

## Features

### Implemented
- User authentication with JWT tokens
- Dashboard with metrics overview
- Lead management interface
- Affiliate partner management
- Advertiser management
- Offer catalog
- Mapping configuration
- Commission tracking interface
- Analytics and reports interface
- User management (admin only)
- Settings page

### Database Schema
- Users table with role-based access
- Affiliates with API key authentication
- Advertisers with endpoint configuration
- Offers with payout tracking
- Mappings for lead routing
- Field mappings for data transformation
- Traffic logs for incoming requests
- Leads table with status tracking
- Forward logs for delivery attempts
- Callback logs for advertiser responses
- Commissions for payout tracking
- API keys for admin access

### Security
- Row Level Security (RLS) enabled on all tables
- Service role policies for backend access
- API key authentication for affiliates
- IP whitelisting support
- JWT token-based authentication
- Password hashing with bcrypt

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## API Endpoints (Backend - In Progress)

The backend API is partially implemented. Completed routes:
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get current user
- `GET /api/users` - List users (admin)
- `POST /api/users` - Create user (admin)
- `PUT /api/users/:id` - Update user (admin)
- `DELETE /api/users/:id` - Delete user (admin)

## Development Notes

### Frontend
- Built with React 18, TypeScript, and Vite
- Styling with Tailwind CSS
- Routing with React Router v6
- State management with React Context
- API calls with Axios
- Icons from Lucide React
- Charts with Recharts
- Notifications with React Hot Toast

### Backend (Partial)
- Express.js REST API
- Supabase for database
- JWT authentication
- CORS enabled
- Request logging
- Error handling middleware

### Database
- PostgreSQL via Supabase
- Row Level Security for data protection
- Indexed columns for performance
- Foreign key constraints
- Timestamp tracking on all tables

## Troubleshooting

### Cannot login
1. Ensure you've run the SQL seed script to create the admin user
2. Check that Supabase environment variables are correct
3. Verify the Supabase project is active

### API errors
1. Check browser console for detailed error messages
2. Verify CORS settings if connecting to a backend
3. Ensure Supabase RLS policies allow service role access

### Build errors
1. Run `npm install` to ensure all dependencies are installed
2. Check Node.js version (requires Node 18+)
3. Clear node_modules and reinstall if needed

## Production Deployment

### Frontend
The frontend can be deployed to any static hosting service:
- Vercel
- Netlify
- Cloudflare Pages
- AWS S3 + CloudFront
- Or any other static host

### Backend
The backend would need:
- Node.js hosting (AWS, DigitalOcean, Heroku, etc.)
- Redis for caching and queues
- Environment variables configured
- SSL certificate for HTTPS

### Database
- Already hosted on Supabase
- Configure production credentials
- Set up automated backups
- Monitor query performance

## Support

For issues or questions:
1. Check the PROJECT_STATUS.md file for current implementation status
2. Review the database schema in the migrations file
3. Check application logs for error details
4. Refer to Supabase documentation for database issues

## License

MIT
