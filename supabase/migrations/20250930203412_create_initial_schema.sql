/*
  # AZLeads CRM Initial Schema

  ## Overview
  Creates the complete database schema for the AZLeads Media Broker CRM system.
  This system manages affiliate marketing leads, forwards them to advertisers,
  and tracks commissions.

  ## New Tables

  ### Authentication & Users
  - `users` - Admin/operator accounts for managing the system
    - `id` (uuid, primary key)
    - `email` (text, unique)
    - `password_hash` (text)
    - `role` (enum: admin, operator)
    - `created_at` (timestamptz)

  ### Affiliates & Advertisers
  - `affiliates` - Partners who send leads to the system
    - `id` (uuid, primary key)
    - `name`, `email`, `api_key_hash`
    - `ip_whitelist` (jsonb array of CIDR strings)
    - `active` (boolean)
    - `last_used_at`, `created_at`

  - `advertisers` - Companies that receive leads
    - `id` (uuid, primary key)
    - `name` (unique), `platform`
    - `endpoint_url`, `endpoint_secret`
    - `created_at`

  ### Offers & Mappings
  - `offers` - Products/services being promoted
    - `id` (uuid, primary key)
    - `advertiser_id` (foreign key)
    - `name`, `payout_amount` (decimal)
    - `created_at`

  - `mappings` - Route affiliate+offer combinations to advertisers
    - `id` (uuid, primary key)
    - `affiliate_id`, `offer_id`, `advertiser_id` (foreign keys)
    - `forward_url` (advertiser endpoint override)
    - `enabled` (boolean)
    - `created_at`

  - `field_mappings` - Transform fields when forwarding to advertisers
    - `id` (uuid, primary key)
    - `advertiser_id` (foreign key)
    - `source_field`, `target_field`
    - `allowlist` (boolean - if true, field is included)
    - `transform` (jsonb - optional transform specification)
    - `created_at`

  ### Leads & Tracking
  - `traffic_logs` - Raw incoming traffic from affiliates
    - `id` (uuid, primary key)
    - `affiliate_id`, `offer_id` (foreign keys)
    - `raw_payload` (jsonb)
    - `ip` (inet), `ua` (user agent)
    - `received_at`

  - `leads` - Processed leads with status tracking
    - `id` (uuid, primary key)
    - `traffic_log_id` (foreign key)
    - `az_tx_id` (unique transaction ID)
    - `affiliate_id`, `advertiser_id`, `offer_id` (foreign keys)
    - `email`, `phone`, `first_name`, `last_name`, `country`
    - `status` (enum: pending, forwarded, approved, rejected, no_mapping, forward_failed)
    - `advertiser_status`, `advertiser_response` (jsonb)
    - `ftd_at` (first-time deposit timestamp)
    - `payout` (decimal)
    - `created_at`, `updated_at`

  - `forward_logs` - History of forwarding attempts
    - `id` (uuid, primary key)
    - `lead_id` (foreign key)
    - `attempt_no` (integer)
    - `request`, `response` (jsonb)
    - `status_code` (integer)
    - `created_at`

  - `callback_logs` - Advertiser callbacks (status updates)
    - `id` (uuid, primary key)
    - `advertiser_id` (foreign key)
    - `az_tx_id` (transaction reference)
    - `payload` (jsonb), `signature`
    - `status_code`, `received_at`

  ### Finance
  - `commissions` - Payout tracking
    - `id` (uuid, primary key)
    - `lead_id`, `advertiser_id`, `affiliate_id` (foreign keys)
    - `amount` (decimal)
    - `description`
    - `created_at`

  ### API Management
  - `api_keys` - API key management for admin users
    - `id` (uuid, primary key)
    - `label`, `token_hash`
    - `scopes` (text array)
    - `owner_user_id` (foreign key)
    - `last_used_at`, `created_at`

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Restrictive policies requiring authentication
  - Service role access for backend operations

  ## Important Notes
  - All timestamps use timestamptz for timezone awareness
  - Foreign keys use RESTRICT to prevent accidental data loss
  - Indexes added for frequently queried columns
  - Default values provided for booleans and timestamps
*/

-- Create enums
CREATE TYPE user_role AS ENUM ('admin', 'operator');
CREATE TYPE lead_status AS ENUM ('pending', 'forwarded', 'approved', 'rejected', 'no_mapping', 'forward_failed');

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  api_key_hash text NOT NULL,
  ip_whitelist jsonb DEFAULT '[]'::jsonb NOT NULL,
  active boolean DEFAULT true NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Advertisers table
CREATE TABLE IF NOT EXISTS advertisers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  endpoint_url text NOT NULL,
  endpoint_secret text NOT NULL,
  platform text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  name text NOT NULL,
  payout_amount decimal(12, 2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Mappings table
CREATE TABLE IF NOT EXISTS mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  advertiser_id uuid NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  forward_url text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Field mappings table
CREATE TABLE IF NOT EXISTS field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  source_field text NOT NULL,
  target_field text NOT NULL,
  allowlist boolean DEFAULT true NOT NULL,
  transform jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Traffic logs table
CREATE TABLE IF NOT EXISTS traffic_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  raw_payload jsonb NOT NULL,
  ip inet NOT NULL,
  ua text NOT NULL,
  received_at timestamptz DEFAULT now() NOT NULL
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traffic_log_id uuid NOT NULL REFERENCES traffic_logs(id) ON DELETE RESTRICT,
  az_tx_id text UNIQUE NOT NULL,
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
  advertiser_id uuid REFERENCES advertisers(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  email text,
  phone text,
  first_name text,
  last_name text,
  country text,
  status lead_status NOT NULL,
  advertiser_status text,
  ftd_at timestamptz,
  advertiser_response jsonb,
  payout decimal(12, 2),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Forward logs table
CREATE TABLE IF NOT EXISTS forward_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  attempt_no integer NOT NULL,
  request jsonb NOT NULL,
  response jsonb,
  status_code integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Callback logs table
CREATE TABLE IF NOT EXISTS callback_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  az_tx_id text NOT NULL,
  payload jsonb NOT NULL,
  signature text,
  status_code integer NOT NULL,
  received_at timestamptz DEFAULT now() NOT NULL
);

-- Commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  advertiser_id uuid NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT,
  amount decimal(12, 2) NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  token_hash text NOT NULL,
  scopes text[] NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliates_active ON affiliates(active);
CREATE INDEX IF NOT EXISTS idx_affiliates_api_key ON affiliates(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_offers_advertiser ON offers(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_mappings_affiliate_offer ON mappings(affiliate_id, offer_id);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_affiliate ON traffic_logs(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_traffic_logs_received ON traffic_logs(received_at);
CREATE INDEX IF NOT EXISTS idx_leads_az_tx_id ON leads(az_tx_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_affiliate ON leads(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_forward_logs_lead ON forward_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_callback_logs_az_tx_id ON callback_logs(az_tx_id);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_advertiser ON commissions(advertiser_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forward_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Service role has full access to users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for affiliates table
CREATE POLICY "Service role has full access to affiliates"
  ON affiliates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for advertisers table
CREATE POLICY "Service role has full access to advertisers"
  ON advertisers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for offers table
CREATE POLICY "Service role has full access to offers"
  ON offers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for mappings table
CREATE POLICY "Service role has full access to mappings"
  ON mappings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for field_mappings table
CREATE POLICY "Service role has full access to field_mappings"
  ON field_mappings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for traffic_logs table
CREATE POLICY "Service role has full access to traffic_logs"
  ON traffic_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for leads table
CREATE POLICY "Service role has full access to leads"
  ON leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for forward_logs table
CREATE POLICY "Service role has full access to forward_logs"
  ON forward_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for callback_logs table
CREATE POLICY "Service role has full access to callback_logs"
  ON callback_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for commissions table
CREATE POLICY "Service role has full access to commissions"
  ON commissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for api_keys table
CREATE POLICY "Service role has full access to api_keys"
  ON api_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);