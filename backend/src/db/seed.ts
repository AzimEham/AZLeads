import bcrypt from 'bcrypt';
import { getDatabase } from './database';
import { logger } from '../lib/logger';

async function seed() {
  try {
    const db = getDatabase();

    logger.info('Starting database seed...');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('email', 'admin@azleads.com')
      .maybeSingle();

    if (!existingUser) {
      const { error: userError } = await db
        .from('users')
        .insert({
          email: 'admin@azleads.com',
          password_hash: hashedPassword,
          role: 'admin',
        });

      if (userError) {
        logger.error('Failed to create admin user:', userError);
      } else {
        logger.info('Created admin user: admin@azleads.com');
      }
    } else {
      logger.info('Admin user already exists');
    }

    const { data: existingAffiliate } = await db
      .from('affiliates')
      .select('id')
      .eq('email', 'affiliate@example.com')
      .maybeSingle();

    if (!existingAffiliate) {
      const { data: affiliate, error: affiliateError } = await db
        .from('affiliates')
        .insert({
          name: 'Demo Affiliate',
          email: 'affiliate@example.com',
          api_key_hash: 'demo_api_key_123',
          ip_whitelist: ['0.0.0.0/0'],
          active: true,
        })
        .select()
        .single();

      if (affiliateError) {
        logger.error('Failed to create affiliate:', affiliateError);
      } else {
        logger.info('Created demo affiliate');

        const { data: advertiser, error: advertiserError } = await db
          .from('advertisers')
          .insert({
            name: 'Demo Advertiser',
            endpoint_url: 'https://example.com/api/leads',
            endpoint_secret: 'secret_123',
            platform: 'custom',
          })
          .select()
          .single();

        if (advertiserError) {
          logger.error('Failed to create advertiser:', advertiserError);
        } else {
          logger.info('Created demo advertiser');

          const { data: offer, error: offerError } = await db
            .from('offers')
            .insert({
              advertiser_id: advertiser.id,
              name: 'Demo Offer',
              payout_amount: 50.00,
            })
            .select()
            .single();

          if (offerError) {
            logger.error('Failed to create offer:', offerError);
          } else {
            logger.info('Created demo offer');

            const { error: mappingError } = await db
              .from('mappings')
              .insert({
                affiliate_id: affiliate.id,
                offer_id: offer.id,
                advertiser_id: advertiser.id,
                forward_url: 'https://example.com/api/leads',
                enabled: true,
              });

            if (mappingError) {
              logger.error('Failed to create mapping:', mappingError);
            } else {
              logger.info('Created demo mapping');
            }

            const { error: fieldMappingError } = await db
              .from('field_mappings')
              .insert([
                {
                  advertiser_id: advertiser.id,
                  source_field: 'email',
                  target_field: 'email',
                  allowlist: true,
                },
                {
                  advertiser_id: advertiser.id,
                  source_field: 'firstName',
                  target_field: 'first_name',
                  allowlist: true,
                },
                {
                  advertiser_id: advertiser.id,
                  source_field: 'lastName',
                  target_field: 'last_name',
                  allowlist: true,
                },
              ]);

            if (fieldMappingError) {
              logger.error('Failed to create field mappings:', fieldMappingError);
            } else {
              logger.info('Created demo field mappings');
            }
          }
        }
      }
    } else {
      logger.info('Demo affiliate already exists');
    }

    logger.info('Database seed completed successfully!');
  } catch (error) {
    logger.error('Database seed failed:', error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
