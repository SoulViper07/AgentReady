import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { evaluateMerchantReadiness } from '../../../lib/engine/evaluator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    let merchantId: string | null = body.merchantId || null;

    if (!action) {
      return NextResponse.json(
        { error: 'action field is required' },
        { status: 400 }
      );
    }

    if (action === 'VERIFY_PRODUCT') {
      const { productId, price, inventory } = body;
      if (!productId) {
        return NextResponse.json(
          { error: 'productId is required for VERIFY_PRODUCT' },
          { status: 400 }
        );
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!existingProduct) {
        return NextResponse.json(
          { error: `Product not found with id: ${productId}` },
          { status: 404 }
        );
      }

      merchantId = existingProduct.merchantId;

      const updateData: {
        priceVerified: boolean;
        inventoryVerified: boolean;
        status: string;
        price?: number;
        inventory?: number;
      } = {
        priceVerified: true,
        inventoryVerified: true,
        status: 'VERIFIED',
      };

      if (price !== undefined && price !== null) {
        updateData.price = typeof price === 'string' ? parseFloat(price) : price;
      }
      if (inventory !== undefined && inventory !== null) {
        updateData.inventory =
          typeof inventory === 'string' ? parseInt(inventory, 10) : inventory;
      }

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: updateData,
      });

      // Auto-resolve related ReadinessIssues for this product
      const relatedIssues = await prisma.readinessIssue.findMany({
        where: {
          merchantId,
          resolved: false,
          description: {
            contains: existingProduct.name,
          },
        },
      });

      for (const issue of relatedIssues) {
        const canResolvePrice =
          issue.category === 'PRICE' &&
          (updateData.price !== undefined || existingProduct.price !== null);
        const canResolveInv =
          issue.category === 'INVENTORY' &&
          (updateData.inventory !== undefined || existingProduct.inventory !== null);
        const canResolveConsistency = issue.category === 'CONSISTENCY';

        if (canResolvePrice || canResolveInv || canResolveConsistency) {
          await prisma.readinessIssue.update({
            where: { id: issue.id },
            data: { resolved: true },
          });
        }
      }

      // Log Audit
      await prisma.auditLog.create({
        data: {
          merchantId,
          eventType: 'MERCHANT_VERIFIED_PRODUCT',
          details: JSON.stringify({
            action: 'VERIFY_PRODUCT',
            productId,
            productName: updatedProduct.name,
            price: updatedProduct.price,
            inventory: updatedProduct.inventory,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } else if (action === 'RESOLVE_CONFLICT') {
      const { issueId, productId, authoritativePrice } = body;
      if (!issueId) {
        return NextResponse.json(
          { error: 'issueId is required for RESOLVE_CONFLICT' },
          { status: 400 }
        );
      }

      const issue = await prisma.readinessIssue.findUnique({
        where: { id: issueId },
      });
      if (!issue) {
        return NextResponse.json(
          { error: `Issue not found with id: ${issueId}` },
          { status: 404 }
        );
      }

      merchantId = issue.merchantId;

      const parsedPrice =
        typeof authoritativePrice === 'string'
          ? parseFloat(authoritativePrice)
          : authoritativePrice;

      // Mark issue as resolved
      await prisma.readinessIssue.update({
        where: { id: issueId },
        data: { resolved: true },
      });

      // Find product
      let targetProductId = productId;
      if (!targetProductId) {
        const products = await prisma.product.findMany({
          where: { merchantId },
        });
        const matched = products.find((p) => issue.description.includes(p.name));
        if (matched) {
          targetProductId = matched.id;
        }
      }

      if (targetProductId) {
        await prisma.product.update({
          where: { id: targetProductId },
          data: {
            price: parsedPrice,
            priceVerified: true,
          },
        });
      }

      // Log Audit
      await prisma.auditLog.create({
        data: {
          merchantId,
          eventType: 'MERCHANT_VERIFIED_PRICE',
          details: JSON.stringify({
            action: 'RESOLVE_CONFLICT',
            issueId,
            productId: targetProductId,
            authoritativePrice: parsedPrice,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } else if (action === 'APPROVE_POLICY') {
      const { policyId, type, content } = body;

      if (!merchantId && body.merchantSlug) {
        const m = await prisma.merchant.findUnique({
          where: { slug: body.merchantSlug },
        });
        if (m) merchantId = m.id;
      }

      if (!merchantId && policyId) {
        const pol = await prisma.policy.findUnique({ where: { id: policyId } });
        if (pol) merchantId = pol.merchantId;
      }

      if (!merchantId) {
        return NextResponse.json(
          { error: 'merchantId or merchantSlug is required for APPROVE_POLICY' },
          { status: 400 }
        );
      }

      let policy;
      if (policyId) {
        policy = await prisma.policy.update({
          where: { id: policyId },
          data: {
            content,
            isVerified: true,
          },
        });
      } else {
        const existing = await prisma.policy.findFirst({
          where: { merchantId, type: type || 'REFUND' },
        });
        if (existing) {
          policy = await prisma.policy.update({
            where: { id: existing.id },
            data: {
              content,
              isVerified: true,
            },
          });
        } else {
          policy = await prisma.policy.create({
            data: {
              merchantId,
              type: type || 'REFUND',
              content,
              isVerified: true,
            },
          });
        }
      }

      // Auto-resolve any related policy issues
      const policyIssues = await prisma.readinessIssue.findMany({
        where: {
          merchantId,
          category: 'POLICY',
          resolved: false,
        },
      });
      for (const pi of policyIssues) {
        await prisma.readinessIssue.update({
          where: { id: pi.id },
          data: { resolved: true },
        });
      }

      // Log Audit
      await prisma.auditLog.create({
        data: {
          merchantId,
          eventType: 'POLICY_APPROVED',
          details: JSON.stringify({
            action: 'APPROVE_POLICY',
            policyId: policy.id,
            type: policy.type,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }

    if (!merchantId) {
      return NextResponse.json(
        { error: 'Could not determine merchant for this action' },
        { status: 400 }
      );
    }

    // Post-Action Pipeline: Re-evaluate readiness
    const evaluation = await evaluateMerchantReadiness(merchantId);

    const remainingIssues = await prisma.readinessIssue.findMany({
      where: { merchantId, resolved: false },
      orderBy: { createdAt: 'desc' },
    });

    const products = await prisma.product.findMany({
      where: { merchantId },
    });

    const policies = await prisma.policy.findMany({
      where: { merchantId },
    });

    return NextResponse.json({
      success: true,
      action,
      merchantId,
      readinessScore: evaluation.readinessScore,
      transactionStatus: evaluation.transactionStatus,
      invariants: evaluation.invariants,
      scoreBreakdown: evaluation.scoreBreakdown,
      remainingIssues,
      products,
      policies,
    });
  } catch (error: unknown) {
    console.error('Verification API error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Internal server error during verification';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
