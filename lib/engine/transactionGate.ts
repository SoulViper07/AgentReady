import { prisma } from '../prisma';
import { Merchant, Product, TransactionProposal } from '@prisma/client';

export type GateResult =
  | {
      allowed: false;
      reason: string;
      proposal?: TransactionProposal;
      auditLogId?: string;
      timestamp?: string;
      violatedInvariant?: string;
      requestedQuantity?: number;
      availableInventory?: number;
    }
  | {
      allowed: true;
      reason?: undefined;
      proposal: TransactionProposal;
      product: Product;
      merchant: Merchant;
    };

/**
 * Deterministic Transaction Gate
 *
 * Runs strict sequential invariant checks on a TransactionProposal before
 * authorizing checkout or order creation:
 * 1. Verify merchant exists and transactionStatus !== "NOT_READY"
 * 2. Verify product exists, priceVerified === true, and status === "VERIFIED"
 * 3. Verify proposal.offeredPrice === product.price
 * 4. Verify proposal.calculatedTotal === (proposal.requestedQuantity * product.price)
 * 5. Check available inventory: product.inventoryVerified === true and product.inventory >= proposal.requestedQuantity
 */
export async function validateAndReserveProposal(
  proposalId: string
): Promise<GateResult> {
  const proposal = await prisma.transactionProposal.findUnique({
    where: { id: proposalId },
    include: {
      merchant: true,
      product: true,
    },
  });

  if (!proposal) {
    return {
      allowed: false,
      reason: `Transaction proposal not found with ID: ${proposalId}`,
    };
  }

  // Already completed or expired checks
  if (proposal.status === 'COMPLETED') {
    return {
      allowed: false,
      reason: 'Transaction proposal has already been completed and paid.',
      proposal,
    };
  }

  let failureReason: string | null = null;

  // Invariant Check 1: Verify merchant exists and transactionStatus !== "NOT_READY"
  if (!proposal.merchant) {
    failureReason = 'Associated merchant does not exist for this proposal.';
  } else if (proposal.merchant.transactionStatus === 'NOT_READY') {
    failureReason = `Merchant transaction status is NOT_READY (readiness score: ${proposal.merchant.readinessScore}/100). Merchant must complete remediation and verification before accepting transactions.`;
  }

  // Invariant Check 2: Verify product exists, priceVerified === true, and status === "VERIFIED"
  else if (!proposal.product) {
    failureReason = 'Associated product does not exist for this proposal.';
  } else if (proposal.product.status !== 'VERIFIED') {
    failureReason = `Product status is "${proposal.product.status}". Must be "VERIFIED" to accept autonomous agent transactions.`;
  } else if (!proposal.product.priceVerified) {
    failureReason = `Product price has not been verified by merchant (priceVerified = false).`;
  }

  // Invariant Check 3: Verify proposal.offeredPrice === product.price
  else if (
    proposal.product.price === null ||
    proposal.offeredPrice !== proposal.product.price
  ) {
    failureReason = `Price mismatch: Proposal offered unit price (₹${proposal.offeredPrice}) does not match verified catalog price (₹${proposal.product.price}).`;
  }

  // Invariant Check 4: Verify proposal.calculatedTotal === (proposal.requestedQuantity * product.price)
  else if (
    Math.round(proposal.calculatedTotal * 100) !==
    Math.round(proposal.requestedQuantity * (proposal.product.price ?? 0) * 100)
  ) {
    const expectedTotal =
      proposal.requestedQuantity * (proposal.product.price ?? 0);
    failureReason = `Total calculation mismatch: Proposal total (₹${proposal.calculatedTotal}) does not match requested quantity (${proposal.requestedQuantity}) × unit price (₹${proposal.product.price}) = ₹${expectedTotal}.`;
  }

  // Invariant Check 5: Check available inventory: product.inventoryVerified === true and product.inventory >= proposal.requestedQuantity
  else if (!proposal.product.inventoryVerified) {
    failureReason = `Product inventory count has not been verified by merchant (inventoryVerified = false).`;
  } else if (
    (proposal.product.inventory ?? 0) < proposal.requestedQuantity
  ) {
    const available = proposal.product.inventory ?? 0;
    failureReason = `INSUFFICIENT_INVENTORY: Requested ${proposal.requestedQuantity} units, but only ${available} verified units remain in stock.`;
  }

  // If ANY check fails:
  if (failureReason) {
    const updated = await prisma.transactionProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'BLOCKED',
        blockReason: failureReason,
      },
    });

    const auditLog = await prisma.auditLog.create({
      data: {
        merchantId: proposal.merchantId,
        eventType: 'TRANSACTION_BLOCKED',
        details: failureReason,
      },
    });

    const violatedInvariant = failureReason.startsWith('INSUFFICIENT_INVENTORY')
      ? 'INSUFFICIENT_INVENTORY'
      : failureReason.includes('NOT_READY')
      ? 'MERCHANT_NOT_READY'
      : failureReason.includes('priceVerified = false') ||
        failureReason.includes('Product status is')
      ? 'PRODUCT_NOT_VERIFIED'
      : failureReason.startsWith('Price mismatch')
      ? 'PRICE_MISMATCH'
      : failureReason.startsWith('Total calculation mismatch')
      ? 'TOTAL_CALCULATION_MISMATCH'
      : 'INVARIANT_VIOLATION';

    return {
      allowed: false,
      reason: failureReason,
      proposal: updated,
      auditLogId: auditLog.id,
      timestamp: auditLog.createdAt.toISOString(),
      violatedInvariant,
      requestedQuantity: proposal.requestedQuantity,
      availableInventory: proposal.product?.inventory ?? 0,
    };
  }

  // If all checks pass: Reserve proposal for 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const reservedProposal = await prisma.transactionProposal.update({
    where: { id: proposal.id },
    data: {
      status: 'RESERVED',
      expiresAt,
      blockReason: null,
    },
    include: {
      merchant: true,
      product: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      merchantId: proposal.merchantId,
      eventType: 'TRANSACTION_RESERVED',
      details: 'Inventory held for 10 minutes',
    },
  });

  return {
    allowed: true,
    proposal: reservedProposal,
    product: reservedProposal.product,
    merchant: reservedProposal.merchant,
  };
}
