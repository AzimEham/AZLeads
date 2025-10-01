# AZLeads CRM - Project Status

## Overview
AZLeads is a Media Broker CRM system for managing affiliate marketing leads, forwarding them to advertisers, and tracking commissions.

## Completed Components

### Database (Supabase)
- Complete schema migration created and applied
- All tables created with proper relationships:
  - Users (authentication)
  - Affiliates (lead sources)
  - Advertisers (lead destinations)
  - Offers (products/services)
  - Mappings (routing configuration)
  - Field Mappings (data transformation)
  - Traffic Logs (incoming data)
  - Leads (processed leads)
  - Forward Logs (delivery tracking)
  - Callback Logs (advertiser responses)
  - Commissions (payouts)
  - API Keys (access management)
- Row Level Security (RLS) enabled on all tables
- Service role policies configured for backend access
- Seed script created for demo data

### Frontend (React + TypeScript + Vite)
- Login page with authentication
- Dashboard layout with sidebar navigation
- All main pages implemented:
  - Dashboard (metrics overview)
  - Leads (lead management)
  - Affiliates (partner management)
  - Advertisers (advertiser management)
  - Offers (offer catalog)
  - Mappings (routing configuration)
  - Finance (commission tracking)
  - Reports (analytics)
  - Settings (system configuration)
  - Users (user management)
- Authentication context with JWT token management
- Supabase client configured
- Tailwind CSS styling with custom theme
- Build successful (717 KB bundle)

### Backend (Node.js + Express + TypeScript)
- Express server setup
- Supabase database integration
- Authentication routes (login, logout, refresh, profile)
- JWT token management
- Redis integration for sessions and rate limiting
- CORS configuration
- Helmet security headers
- Request logging
- Metrics endpoint
- Error handling middleware
- Rate limiting middleware

### Configuration
- Environment variables configured for both frontend and backend
- Supabase connection details set up
- JWT secrets configured
- CORS origins whitelisted
- Redis URL configured

## Known Issues & Incomplete Items

### Backend Routes
The backend has many routes still using Prisma ORM syntax instead of Supabase client. The following routes need migration:
- `/api/users/*` - User management endpoints
- `/api/affiliates/*` - Affiliate management
- `/api/advertisers/*` - Advertiser management
- `/api/offers/*` - Offer management
- `/api/mappings/*` - Mapping configuration
- `/api/leads/*` - Lead processing
- `/api/reports/*` - Analytics endpoints
- `/api/finance/*` - Financial tracking
- `/api/track` - Tracking endpoint for affiliate traffic
- `/api/callback` - Advertiser callback handler

### Background Jobs
- Queue system configured but needs testing
- Forward lead job implemented but needs Supabase migration
- Retention job implemented but needs Supabase migration

### Edge Functions
- Forward lead edge function created but needs deployment testing

## Getting Started

### Prerequisites
- Node.js 18+
- Redis server (for sessions and queues)
- Supabase account

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Access at: http://localhost:5173

Default credentials:
- Email: admin@azleads.com
- Password: admin123

### Backend Setup
```bash
cd backend
npm install

# Seed the database with demo data
npm run db:seed

# Start the server
npm run dev
```

API runs at: http://localhost:4000

### Environment Variables

#### Frontend (.env)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

#### Backend (.env)
```
NODE_ENV=development
PORT=4000

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

JWT_ACCESS_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

REDIS_URL=redis://localhost:6379

CORS_ORIGINS=http://localhost:5173
```

## Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Caching**: Redis
- **Queue**: BullMQ
- **Auth**: JWT tokens

### Key Features
1. **Affiliate Tracking**: Track incoming leads from multiple affiliate partners
2. **Lead Routing**: Intelligent mapping of leads to advertisers based on affiliate + offer
3. **Field Transformation**: Custom field mapping per advertiser
4. **Forwarding**: HTTP POST to advertiser endpoints with retry logic
5. **Callbacks**: Receive status updates from advertisers
6. **Commission Tracking**: Calculate and track affiliate payouts
7. **Reporting**: Comprehensive analytics and conversion tracking
8. **Security**: API key authentication, IP whitelisting, JWT tokens, RLS

## Next Steps

To complete the project:

1. Migrate remaining backend routes from Prisma to Supabase client syntax
2. Test all API endpoints
3. Deploy edge function for lead forwarding
4. Set up Redis for production
5. Configure queue workers for background jobs
6. Add comprehensive error handling
7. Write unit and integration tests
8. Set up CI/CD pipeline
9. Configure production environment variables
10. Deploy to production

## API Documentation

Once backend routes are fixed, Swagger documentation will be available at:
http://localhost:4000/api-docs

## Security Considerations

- All database tables have Row Level Security enabled
- API keys are hashed before storage
- JWT tokens are short-lived with refresh token rotation
- CORS is configured to specific origins only
- Rate limiting is in place for all endpoints
- Sensitive data is never logged
- IP whitelisting for affiliate API access

## Support

For issues or questions, please refer to the code comments and this documentation.
