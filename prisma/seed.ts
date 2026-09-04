import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database...');
  await prisma.order.deleteMany();
  await prisma.transactionProposal.deleteMany();
  await prisma.readinessIssue.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.product.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.merchant.deleteMany();

  console.log('Inserting demo merchant...');
  const merchant = await prisma.merchant.create({
    data: {
      name: 'Sweet Crumbs',
      slug: 'sweet-crumbs',
      location: 'Chandannagar & Chuchura',
      contactPhone: '+91 8697774043',
      readinessScore: 0,
      transactionStatus: 'NOT_READY',
      auditLogs: {
        create: {
          eventType: 'MERCHANT_ONBOARDED',
          details: JSON.stringify({
            action: 'MERCHANT_ONBOARDED',
            merchant: 'Sweet Crumbs',
            location: 'Chandannagar & Chuchura',
            contact: '+91 8697774043',
          }),
        },
      },
    },
    include: {
      auditLogs: true,
    },
  });

  console.log(`Seeded merchant: ${merchant.name} (ID: ${merchant.id})`);
  console.log(`Initial audit logs count: ${merchant.auditLogs.length}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
