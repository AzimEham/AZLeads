import { SupabaseClient } from '@supabase/supabase-js';
import { initSupabase, getSupabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export async function setupDatabase(): Promise<void> {
  try {
    initSupabase();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export function getDatabase(): SupabaseClient {
  return getSupabase();
}