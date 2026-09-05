import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      proposalId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        {
          error:
            'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)',
        },
        { status: 400 }
      );
    }

    // 1. Find Order record
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
      include: {
        proposal: {
          include: {
            product: true,
            merchant: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: `Order not found for razorpayOrderId: ${razorpay_order_id}` },
        { status: 404 }
      );
    }

    // 2. Validate HMAC SHA-256 signature
    const secret =
      process.env.RAZORPAY_KEY_SECRET || 'rzp_test_placeholder_secret';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    const isValid = generatedSignature === razorpay_signature;

    // 3. Signature verification failed
    if (!isValid) {
      // Update Order: status = "FAILED"
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      });

      // Update TransactionProposal: status = "EXPIRED"
      await prisma.transactionProposal.update({
        where: { id: order.transactionProposalId },
        data: {
          status: 'EXPIRED',
          blockReason: 'Payment signature mismatch (HMAC-SHA256)',
        },
      });

      // Insert AuditLog: PAYMENT_SIGNATURE_MISMATCH
      await prisma.auditLog.create({
        data: {
          merchantId: order.proposal.merchantId,
          eventType: 'PAYMENT_SIGNATURE_MISMATCH',
          details: `Cryptographic HMAC SHA-256 signature mismatch for order ${razorpay_order_id} with payment ID ${razorpay_payment_id}`,
        },
      });

      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // 4. Signature verification succeeded
    // Atomically update Order, Proposal, and decrement product inventory
    const [updatedProduct] = await prisma.$transaction([
      prisma.product.update({
        where: { id: order.proposal.productId },
        data: {
          inventory: {
            decrement: order.proposal.requestedQuantity,
          },
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          signature: razorpay_signature,
          razorpayPaymentId: razorpay_payment_id,
        },
      }),
      prisma.transactionProposal.update({
        where: { id: order.transactionProposalId },
        data: {
          status: 'COMPLETED',
        },
      }),
    ]);

    // Insert AuditLog: PAYMENT_VERIFIED
    await prisma.auditLog.create({
      data: {
        merchantId: order.proposal.merchantId,
        eventType: 'PAYMENT_VERIFIED',
        details: `Payment ${razorpay_payment_id} verified for order ${razorpay_order_id} via HMAC SHA-256 signature. Amount: ₹${(order.amount / 100).toFixed(2)}`,
      },
    });

    // Insert AuditLog: INVENTORY_DEDUCTED
    await prisma.auditLog.create({
      data: {
        merchantId: order.proposal.merchantId,
        eventType: 'INVENTORY_DEDUCTED',
        details: `Deducted ${order.proposal.requestedQuantity} unit(s) from product "${order.proposal.product.name}". Remaining stock: ${updatedProduct.inventory}`,
      },
    });

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      proposalId: order.proposal.id || proposalId,
      remainingInventory: updatedProduct.inventory,
      productName: order.proposal.product.name,
      amount: order.amount,
      signature: razorpay_signature,
      calculatedHmac: generatedSignature,
    });
  } catch (error: unknown) {
    console.error('Verify API error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
