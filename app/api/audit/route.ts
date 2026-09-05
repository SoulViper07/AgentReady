import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantSlug = searchParams.get('merchantSlug') || 'sweet-crumbs';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const eventType = searchParams.get('eventType');

    const merchant = await prisma.merchant.findUnique({
      where: { slug: merchantSlug },
    });

    if (!merchant) {
      return NextResponse.json(
        { error: `Merchant not found for slug: ${merchantSlug}` },
        { status: 404 }
      );
    }

    const where: { merchantId: string; eventType?: string } = {
      merchantId: merchant.id,
    };
    if (eventType) {
      where.eventType = eventType;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      merchantSlug,
      total: logs.length,
      totalCount: logs.length,
      logs,
    });
  } catch (error: unknown) {
    console.error('Audit API error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal error in Audit API';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
