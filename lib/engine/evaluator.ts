import { prisma } from '../prisma';
import { checkTransactionInvariants, InvariantResult } from './invariants';
import { calculateQualityScore, ScoreResult } from './scoring';

export type TransactionStatus = 'NOT_READY' | 'CONDITIONALLY_READY' | 'READY';

export interface EvaluationSummary {
  merchantId: string;
  merchantSlug: string;
  merchantName: string;
  readinessScore: number;
  transactionStatus: TransactionStatus;
  invariants: InvariantResult;
  scoreBreakdown: ScoreResult['breakdown'];
  evaluatedAt: string;
}

export async function evaluateMerchantReadiness(
  merchantId: string
): Promise<EvaluationSummary> {
  // Fetch merchant, products, policies, and issues using Prisma
  const merchant = await prisma.merchant.findFirst({
    where: {
      OR: [{ id: merchantId }, { slug: merchantId }],
    },
    include: {
      products: true,
      policies: true,
      issues: true,
    },
  });

  if (!merchant) {
    throw new Error(`Merchant not found with identifier: ${merchantId}`);
  }

  // Run invariant gate and score calculator
  const invariants = await checkTransactionInvariants(merchant.id, {
    products: merchant.products,
    policies: merchant.policies,
    issues: merchant.issues,
  });

  const score = await calculateQualityScore(merchant.id, {
    products: merchant.products,
    policies: merchant.policies,
    issues: merchant.issues,
  });

  // Determine status:
  // - If !invariants.passed: status = NOT_READY
  // - Else if score < 60: status = NOT_READY
  // - Else if score < 80: status = CONDITIONALLY_READY
  // - Else: status = READY
  let status: TransactionStatus;
  if (!invariants.passed) {
    status = 'NOT_READY';
  } else if (score.totalScore < 60) {
    status = 'NOT_READY';
  } else if (score.totalScore < 80) {
    status = 'CONDITIONALLY_READY';
  } else {
    status = 'READY';
  }

  // Update Merchant record in the database with the new readinessScore and transactionStatus
  await prisma.merchant.update({
    where: { id: merchant.id },
    data: {
      readinessScore: score.totalScore,
      transactionStatus: status,
    },
  });

  // Insert an AuditLog record: READINESS_EVALUATED with details containing score and status
  const timestamp = new Date().toISOString();
  await prisma.auditLog.create({
    data: {
      merchantId: merchant.id,
      eventType: 'READINESS_EVALUATED',
      details: JSON.stringify({
        readinessScore: score.totalScore,
        transactionStatus: status,
        invariantsPassed: invariants.passed,
        failuresCount: invariants.failures.length,
        failures: invariants.failures,
        breakdown: score.breakdown,
        evaluatedAt: timestamp,
      }),
    },
  });

  return {
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
    merchantName: merchant.name,
    readinessScore: score.totalScore,
    transactionStatus: status,
    invariants,
    scoreBreakdown: score.breakdown,
    evaluatedAt: timestamp,
  };
}
