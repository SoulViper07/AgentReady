import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantSlug = searchParams.get('merchantSlug');
    const egglessParam = searchParams.get('eggless');
    const maxPriceParam = searchParams.get('maxPrice');
    const searchParam = searchParams.get('search');

    // 1. Filter only merchants with transactionStatus !== 'NOT_READY'
    const merchantWhere: Record<string, unknown> = {
      transactionStatus: {
        not: 'NOT_READY',
      },
    };

    if (merchantSlug) {
      merchantWhere.slug = merchantSlug;
    }

    const merchants = await prisma.merchant.findMany({
      where: merchantWhere,
      include: {
        policies: {
          where: { isVerified: true },
          select: {
            type: true,
            content: true,
          },
        },
        products: {
          where: {
            priceVerified: true,
            inventoryVerified: true,
            inventory: {
              gt: 0,
            },
            price: {
              gt: 0,
            },
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            inventory: true,
            isEggless: true,
            status: true,
          },
        },
      },
    });

    // 2. Filter products based on optional query parameters
    const parsedMaxPrice = maxPriceParam ? parseFloat(maxPriceParam) : null;
    const isEgglessFilter =
      egglessParam !== null && egglessParam !== undefined
        ? egglessParam.toLowerCase() === 'true'
        : null;
    const searchLower = searchParam ? searchParam.toLowerCase().trim() : null;

    const filteredMerchants = merchants
      .map((m) => {
        let matchingProducts = m.products;

        if (isEgglessFilter !== null) {
          matchingProducts = matchingProducts.filter(
            (p) => p.isEggless === isEgglessFilter
          );
        }

        if (parsedMaxPrice !== null && !isNaN(parsedMaxPrice)) {
          matchingProducts = matchingProducts.filter(
            (p) => p.price !== null && p.price <= parsedMaxPrice
          );
        }

        if (searchLower) {
          matchingProducts = matchingProducts.filter(
            (p) =>
              p.name.toLowerCase().includes(searchLower) ||
              (p.description && p.description.toLowerCase().includes(searchLower))
          );
        }

        return {
          id: m.id,
          name: m.name,
          slug: m.slug,
          readinessScore: m.readinessScore,
          policies: m.policies.map((pol) => ({
            type: pol.type,
            content: pol.content || '',
          })),
          products: matchingProducts.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            currency: p.currency,
            inventory: p.inventory,
            isEggless: p.isEggless,
            status: p.status,
          })),
        };
      })
      // Only return merchants that have at least 1 matching product
      .filter((m) => m.products.length > 0);

    return NextResponse.json({
      version: '1.0',
      generatedAt: new Date().toISOString(),
      merchants: filteredMerchants,
    });
  } catch (error: unknown) {
    console.error('Catalog API error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal error loading catalog';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
