# AZLeads Media Broker CRM

A comprehensive CRM system for managing affiliate marketing leads, routing them to advertisers, and tracking commissions.

## Features

- **Lead Management**: Track and manage leads from multiple affiliate partners
- **Intelligent Routing**: Automatically route leads to advertisers based on affiliate + offer mappings
- **Field Transformation**: Custom field mapping for each advertiser
- **Delivery Tracking**: Monitor lead forwarding with retry logic
- **Callback Handling**: Receive and process status updates from advertisers
- **Commission Tracking**: Calculate and track affiliate payouts
- **Analytics & Reporting**: Comprehensive conversion tracking and performance metrics
- **Multi-user Support**: Role-based access control (admin/operator)
- **API Authentication**: Secure API key authentication with IP whitelisting
- **Real-time Dashboard**: Live metrics and status monitoring

## Quick Start

### Prerequisites
- Node.js 18 or higher
- Supabase account (database is pre-configured)

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env and fill in your Supabase credentials

# Start development server
npm run dev
```

Visit http://localhost:5173 and login with:
- Email: admin@azleads.com
- Password: admin123

**Note**: You need to run the database seed SQL first (see SETUP_INSTRUCTIONS.md)

### Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router
- **Backend**: Node.js, Express, TypeScript (partial implementation)
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Authentication**: JWT tokens with bcrypt password hashing

## Project Structure

- `/frontend` - React application
  - `/src/pages` - Page components for each route
  - `/src/components` - Reusable UI components
  - `/src/contexts` - React contexts (Auth, etc.)
  - `/src/lib` - Utilities and Supabase client
- `/backend` - Node.js API (partial implementation)
- `/supabase/migrations` - Database schema
- `/supabase/functions` - Edge functions

## Documentation

- [Setup Instructions](SETUP_INSTRUCTIONS.md) - Detailed setup guide
- [Project Status](PROJECT_STATUS.md) - Current implementation status
- [Database Schema](supabase/migrations/20250930203412_create_initial_schema.sql) - Complete schema with comments

## Security Features

- Row Level Security (RLS) on all database tables
- JWT token authentication with refresh tokens
- Bcrypt password hashing
- API key authentication for affiliate endpoints
- IP whitelisting support
- CORS protection
- Rate limiting ready

## Current Status

### ✅ Completed
- Complete database schema with 12 tables
- Full frontend implementation with all pages
- User authentication system
- Modern, responsive UI
- Production-ready frontend build

### 🚧 Partial
- Backend API (auth routes complete, other routes need conversion from Prisma to Supabase)
- Background job queue system
- Edge functions

### 📋 Planned
- Email notifications
- Webhook integrations
- Advanced analytics
- Multi-language support

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get current user profile

### Management (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

*Additional endpoints are planned for leads, affiliates, advertisers, offers, etc.*

## License

MIT

## Contributing

This is a production CRM system. For issues or feature requests, please refer to the PROJECT_STATUS.md file for implementation details.
