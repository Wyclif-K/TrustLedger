// =============================================================================
// TrustLedger - Database Seed Script
// Creates super admin + auditor in PostgreSQL. On-chain registration is skipped unless
// you run with Hyperledger Fabric enabled (FABRIC_ENABLED=true).
// Run: npm run db:seed
// =============================================================================

'use strict';

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding TrustLedger database...\n');

  // ── Super Admin ────────────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('TrustLedger@Admin2024!', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@trustledger.com' },
    update: {},
    create: {
      memberId:     'ADM001',
      email:        'admin@trustledger.com',
      phone:        '+256700000001',
      passwordHash: adminPasswordHash,
      fullName:     'TrustLedger Super Admin',
      nationalId:   'ADMIN-001',
      role:         'SUPER_ADMIN',
      status:       'ACTIVE',
    },
  });
  console.log(`✅ Super admin created: ${admin.email}`);

  // ── Auditor ────────────────────────────────────────────────────────────────
  const auditorPasswordHash = await bcrypt.hash('Auditor@2024!', 12);

  const auditor = await prisma.user.upsert({
    where:  { email: 'auditor@trustledger.com' },
    update: {},
    create: {
      memberId:     'AUD001',
      email:        'auditor@trustledger.com',
      phone:        '+256700000002',
      passwordHash: auditorPasswordHash,
      fullName:     'SACCO Auditor',
      nationalId:   'AUDITOR-001',
      role:         'AUDITOR',
      status:       'ACTIVE',
    },
  });
  console.log(`✅ Auditor created: ${auditor.email}`);

  // ── Sample member (USSD / mobile app testing) ──────────────────────────────
  const memberPasswordHash = await bcrypt.hash('Member@2024!', 12);
  const sampleMember = await prisma.user.upsert({
    where:  { email: 'alice@example.com' },
    update: { phone: '+256700123456', status: 'ACTIVE' },
    create: {
      memberId:     'MEM001',
      email:        'alice@example.com',
      phone:        '+256700123456',
      passwordHash: memberPasswordHash,
      fullName:     'Alice Nakato',
      nationalId:   'CM900123456',
      role:         'MEMBER',
      status:       'ACTIVE',
    },
  });
  console.log(`✅ Sample member created: ${sampleMember.email} (phone ${sampleMember.phone})`);

  const fabricEnabled = String(process.env.FABRIC_ENABLED || 'false').toLowerCase() === 'true';
  if (fabricEnabled) {
    try {
      const fabricService = require('./services/fabric.service');
      try {
        await fabricService.SavingsContract.evaluate('getMember', 'MEM001');
        console.log('   ℹ️  MEM001 already on blockchain');
      } catch {
        await fabricService.SavingsContract.submit(
          'registerMember',
          'MEM001',
          'Alice Nakato',
          '+256700123456',
          'CM900123456',
          'member',
        );
        console.log('   ✅ MEM001 registered on blockchain (USSD balance/loans will work after deposits)');
      }
    } catch (err) {
      console.warn(`   ⚠️  Could not register MEM001 on Fabric: ${err.message}`);
      console.warn('      USSD will recognize the phone but balance checks need Fabric + on-chain registration.');
    }
  } else {
    console.log('   ⚠️  FABRIC_ENABLED=false — register MEM001 on-chain via admin → Members when Fabric is up.');
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  Seed complete. Default credentials:');
  console.log('══════════════════════════════════════════');
  console.log('  Super Admin  admin@trustledger.com  /  TrustLedger@Admin2024!');
  console.log('  Auditor      auditor@trustledger.com  /  Auditor@2024!');
  console.log('  Sample member alice@example.com  /  Member@2024!  (USSD phone +256700123456)');
  console.log('══════════════════════════════════════════');
  console.log('  ⚠️  Change all passwords before going live!');

  await prisma.$disconnect();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
