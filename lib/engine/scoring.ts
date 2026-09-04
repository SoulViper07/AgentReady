import { prisma } from '../prisma';

export interface ScoreResult {
  totalScore: number;
  breakdown: {
    productData: number;
    priceReliability: number;
    inventoryConfidence: number;
    policyReadiness: number;
    dataConsistency: number;
  };
}

export interface ScoringData {
  products: Array<{
    name: string;
    description: string | null;
    isEggless: boolean | null;
    price: number | null;
    priceVerified: boolean;
    inventory: number | null;
    inventoryVerified: boolean;
  }>;
  policies: Array<{
    type: string;
    content: string | null;
    isVerified: boolean;
  }>;
  issues: Array<{
    category: string;
    resolved: boolean;
  }>;
}

export async function calculateQualityScore(
  merchantId: string,
  preloadedData?: ScoringData
): Promise<ScoreResult> {
  let data = preloadedData;

  if (!data) {
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
      throw new Error(`Merchant not found for identifier: ${merchantId}`);
    }

    data = {
      products: merchant.products,
      policies: merchant.policies,
      issues: merchant.issues,
    };
  }

  const { products, policies, issues } = data;
  const totalProducts = products.length;

  // 1. Product Data (20 pts):
  // Points awarded based on ratio of products having complete descriptions, explicit dietary flags (isEggless !== null), and clean names.
  let productData = 0;
  if (totalProducts > 0) {
    let totalCompletenessSum = 0;
    for (const p of products) {
      const cleanName = typeof p.name === 'string' && p.name.trim().length > 0 ? 1 : 0;
      const hasDescription =
        typeof p.description === 'string' && p.description.trim().length > 0 ? 1 : 0;
      const hasDietaryFlag = p.isEggless !== null && p.isEggless !== undefined ? 1 : 0;
      const productCompleteness = (cleanName + hasDescription + hasDietaryFlag) / 3;
      totalCompletenessSum += productCompleteness;
    }
    const ratio = totalCompletenessSum / totalProducts;
    productData = Math.round(ratio * 20 * 10) / 10;
  }
  productData = Math.max(0, Math.min(20, productData));

  // 2. Price Reliability (20 pts):
  // (verifiedProductsWithPrice / totalProducts) * 20. Deduct 10 points if any product price is null.
  let priceReliability = 0;
  if (totalProducts > 0) {
    const verifiedProductsWithPrice = products.filter(
      (p) => p.priceVerified === true && p.price !== null && p.price > 0
    ).length;
    let basePriceScore = (verifiedProductsWithPrice / totalProducts) * 20;

    const hasAnyNullPrice = products.some(
      (p) => p.price === null || p.price === undefined
    );
    if (hasAnyNullPrice) {
      basePriceScore -= 10;
    }
    priceReliability = Math.round(basePriceScore * 10) / 10;
  }
  priceReliability = Math.max(0, Math.min(20, priceReliability));

  // 3. Inventory Confidence (20 pts):
  // (verifiedProductsWithInventory / totalProducts) * 20. Deduct 10 points if inventory is null.
  let inventoryConfidence = 0;
  if (totalProducts > 0) {
    const verifiedProductsWithInventory = products.filter(
      (p) => p.inventoryVerified === true && p.inventory !== null && p.inventory > 0
    ).length;
    let baseInventoryScore = (verifiedProductsWithInventory / totalProducts) * 20;

    const hasAnyNullInventory = products.some(
      (p) => p.inventory === null || p.inventory === undefined
    );
    if (hasAnyNullInventory) {
      baseInventoryScore -= 10;
    }
    inventoryConfidence = Math.round(baseInventoryScore * 10) / 10;
  }
  inventoryConfidence = Math.max(0, Math.min(20, inventoryConfidence));

  // 4. Policy Readiness (20 pts):
  // 10 points for a verified refund/perishability policy, 10 points for delivery coverage details.
  let policyReadiness = 0;
  const hasVerifiedRefundPolicy = policies.some(
    (p) =>
      (p.type === 'REFUND' || /refund|return|perish/i.test(p.content || '')) &&
      p.isVerified === true
  );
  if (hasVerifiedRefundPolicy) {
    policyReadiness += 10;
  }

  const hasDeliveryCoverageDetails = policies.some(
    (p) =>
      (p.type === 'DELIVERY' || /deliver/i.test(p.content || '')) &&
      Boolean(p.content && p.content.trim().length > 0)
  );
  if (hasDeliveryCoverageDetails) {
    policyReadiness += 10;
  }
  policyReadiness = Math.max(0, Math.min(20, policyReadiness));

  // 5. Data Consistency (20 pts):
  // Starts at 20 points. Deduct 10 points for each unresolved ReadinessIssue of category CONSISTENCY. Minimum 0.
  const unresolvedConsistencyIssues = issues.filter(
    (i) => i.category === 'CONSISTENCY' && !i.resolved
  ).length;
  let dataConsistency = 20 - unresolvedConsistencyIssues * 10;
  dataConsistency = Math.max(0, Math.min(20, dataConsistency));

  const totalScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        productData +
          priceReliability +
          inventoryConfidence +
          policyReadiness +
          dataConsistency
      )
    )
  );

  return {
    totalScore,
    breakdown: {
      productData,
      priceReliability,
      inventoryConfidence,
      policyReadiness,
      dataConsistency,
    },
  };
}
