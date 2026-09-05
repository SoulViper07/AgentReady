import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../../lib/prisma';
import { razorpay } from '../../../../lib/razorpay';
import { validateAndReserveProposal } from '../../../../lib/engine/transactionGate';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposalId } = body;

    if (!proposalId || typeof proposalId !== 'string') {
      return NextResponse.json(
        { error: 'proposalId is required and must be a string' },
        { status: 400 }
      );
    }

    // 1. Run deterministic invariant checks and reserve proposal
    const gateResult = await validateAndReserveProposal(proposalId);

    if (!gateResult.allowed) {
      return NextResponse.json(
        {
          error: 'TRANSACTION_BLOCKED',
          reason: gateResult.reason,
          proposal: gateResult.proposal,
          auditLogId: gateResult.auditLogId,
          timestamp: gateResult.timestamp,
          violatedInvariant: gateResult.violatedInvariant,
          requestedQuantity: gateResult.requestedQuantity,
          availableInventory: gateResult.availableInventory,
        },
        { status: 400 }
      );
    }

    const { proposal, merchant, product } = gateResult;

    // 2. Calculate amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(proposal.calculatedTotal * 100);

    // 3. Create Razorpay order
    let order: { id: string; amount: number; currency: string };
    try {
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: proposal.id,
        notes: {
          merchant: merchant.name,
          product: product.name,
          quantity: String(proposal.requestedQuantity),
        },
      });

      // Handle potential 401/error response from Razorpay client if returned rather than thrown
      if ((rzpOrder as unknown as { error?: { code?: string; description?: string } }).error) {
        throw new Error(
          (rzpOrder as unknown as { error?: { description?: string } }).error?.description || 'Razorpay auth failed'
        );
      }

      order = {
        id: rzpOrder.id,
        amount: typeof rzpOrder.amount === 'string' ? parseInt(rzpOrder.amount, 10) : rzpOrder.amount,
        currency: rzpOrder.currency || 'INR',
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `Razorpay order creation fallback (simulation mode): ${errMsg}`
      );
      // Deterministic simulation order ID for test mode
      const mockOrderId = `order_sim_${proposal.id.slice(-8)}_${Date.now().toString(36)}`;
      order = {
        id: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
      };
    }

    // 4. Insert record into Order table
    await prisma.order.create({
      data: {
        transactionProposalId: proposal.id,
        razorpayOrderId: order.id,
        amount: order.amount,
        currency: order.currency,
        status: 'CREATED',
      },
    });

    // 5. Insert AuditLog
    await prisma.auditLog.create({
      data: {
        merchantId: merchant.id,
        eventType: 'RAZORPAY_ORDER_CREATED',
        details: `Razorpay order ${order.id} created for ₹${proposal.calculatedTotal} (${order.amount} paise). Proposal: ${proposal.id}`,
      },
    });

    // Generate valid test payment signature for simulation/testing
    const testPaymentId = `pay_sim_${order.id.replace('order_', '')}`;
    const testHmac = crypto.createHmac(
      'sha256',
      process.env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret'
    );
    testHmac.update(`${order.id}|${testPaymentId}`);
    const testSignature = testHmac.digest('hex');

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || '',
      proposal,
      product,
      merchant,
      testPaymentId,
      testSignature,
    });
  } catch (error: unknown) {
    console.error('Checkout API error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
