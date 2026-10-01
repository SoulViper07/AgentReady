import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { runAIBuyer } from '../../../lib/ai/buyer';

// In-memory session isolation mapping (sessionId -> proposalIds[])
const sessionProposals = new Map<string, string[]>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, merchantSlug, allowDraftForDemo, sessionId } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' },
        { status: 400 }
      );
    }

    // 1. Run the AI Buyer
    const buyerResult = await runAIBuyer(query, {
      merchantSlug,
      allowDraftForDemo,
    });

    type SavedProposalType = Prisma.TransactionProposalGetPayload<{
      include: {
        product: true;
        merchant: {
          select: {
            id: true;
            name: true;
            slug: true;
            transactionStatus: true;
            readinessScore: true;
          };
        };
      };
    }>;
    let savedProposal: SavedProposalType | null = null;

    // 2. If a proposal was generated, save it in the database
    if (buyerResult.proposalData) {
      const { proposalData } = buyerResult;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      savedProposal = await prisma.transactionProposal.create({
        data: {
          merchantId: proposalData.merchantId,
          productId: proposalData.productId,
          requestedQuantity: proposalData.requestedQuantity,
          offeredPrice: proposalData.offeredPrice,
          calculatedTotal: proposalData.calculatedTotal,
          status: 'PROPOSED',
          expiresAt,
        },
        include: {
          product: true,
          merchant: {
            select: {
              id: true,
              name: true,
              slug: true,
              transactionStatus: true,
              readinessScore: true,
            },
          },
        },
      });

      if (sessionId && typeof sessionId === 'string' && savedProposal) {
        const propId = savedProposal.id;
        const existing = sessionProposals.get(sessionId) || [];
        sessionProposals.set(sessionId, [propId, ...existing.filter((id) => id !== propId)]);
      }

      // 3. Create AuditLog entry: TRANSACTION_PROPOSAL_CREATED
      await prisma.auditLog.create({
        data: {
          merchantId: proposalData.merchantId,
          eventType: 'TRANSACTION_PROPOSAL_CREATED',
          details: JSON.stringify({
            action: 'TRANSACTION_PROPOSAL_CREATED',
            proposalId: savedProposal.id,
            productId: proposalData.productId,
            productName: proposalData.productName,
            requestedQuantity: proposalData.requestedQuantity,
            offeredPrice: proposalData.offeredPrice,
            calculatedTotal: proposalData.calculatedTotal,
            expiresAt: expiresAt.toISOString(),
            inventoryExceeded: proposalData.inventoryExceeded,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      status: buyerResult.status,
      query: buyerResult.query,
      thoughtProcess: buyerResult.thoughtProcess,
      toolCalls: buyerResult.toolCalls,
      proposalData: buyerResult.proposalData,
      proposal: savedProposal,
      explanation: buyerResult.explanation,
    });
  } catch (error: unknown) {
    console.error('AI Buyer API error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal error in AI Buyer API';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantSlug = searchParams.get('merchantSlug');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const where: Record<string, unknown> = {};
    if (merchantSlug) {
      where.merchant = { slug: merchantSlug };
    }
    if (sessionId) {
      const proposalIds = sessionProposals.get(sessionId) || [];
      if (proposalIds.length === 0) {
        return NextResponse.json({
          success: true,
          count: 0,
          proposals: [],
        });
      }
      where.id = { in: proposalIds };
    }

    const proposals = await prisma.transactionProposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        product: true,
        merchant: {
          select: {
            id: true,
            name: true,
            slug: true,
            readinessScore: true,
            transactionStatus: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: proposals.length,
      proposals,
    });
  } catch (error: unknown) {
    console.error('Get proposals error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal error loading proposals';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
