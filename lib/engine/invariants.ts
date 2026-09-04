import { prisma } from '../prisma';

export interface InvariantResult {
  passed: boolean;
  failures: string[];
}

export interface InvariantData {
  products: Array<{
    price: number | null;
    priceVerified: boolean;
    inventory: number | null;
    inventoryVerified: boolean;
  }>;
  policies: Array<{
    isVerified: boolean;
  }>;
  issues: Array<{
    severity: string;
    resolved: boolean;
    title: string;
  }>;
}

export async function checkTransactionInvariants(
  merchantId: string,
  preloadedData?: InvariantData
): Promise<InvariantResult> {
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
      return {
        passed: false,
        failures: [`Merchant not found for identifier: ${merchantId}`],
      };
    }

    data = {
      products: merchant.products,
      policies: merchant.policies,
      issues: merchant.issues,
    };
  }

  const failures: string[] = [];

  // Check 1: Does the merchant have at least 1 product with priceVerified === true and price > 0?
  const hasVerifiedPriceProduct = data.products.some(
    (p) => p.priceVerified === true && p.price !== null && p.price > 0
  );
  if (!hasVerifiedPriceProduct) {
    failures.push(
      'Invariant 1 Failed: Merchant must have at least 1 product with a verified price (priceVerified === true and price > 0).'
    );
  }

  // Check 2: Does the merchant have at least 1 product with inventoryVerified === true and inventory > 0?
  const hasVerifiedInventoryProduct = data.products.some(
    (p) => p.inventoryVerified === true && p.inventory !== null && p.inventory > 0
  );
  if (!hasVerifiedInventoryProduct) {
    failures.push(
      'Invariant 2 Failed: Merchant must have at least 1 product with verified inventory (inventoryVerified === true and inventory > 0).'
    );
  }

  // Check 3: Does the merchant have at least 1 verified policy (isVerified === true)?
  const hasVerifiedPolicy = data.policies.some((p) => p.isVerified === true);
  if (!hasVerifiedPolicy) {
    failures.push(
      'Invariant 3 Failed: Merchant must have at least 1 verified policy (isVerified === true).'
    );
  }

  // Check 4: Are there ZERO unresolved CRITICAL issues in ReadinessIssue?
  const unresolvedCriticalIssues = data.issues.filter(
    (i) => i.severity === 'CRITICAL' && !i.resolved
  );
  if (unresolvedCriticalIssues.length > 0) {
    const issueTitles = unresolvedCriticalIssues.map((i) => `"${i.title}"`).join(', ');
    failures.push(
      `Invariant 4 Failed: Zero unresolved CRITICAL issues permitted. Found ${unresolvedCriticalIssues.length} unresolved issue(s): ${issueTitles}.`
    );
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
