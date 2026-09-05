import { prisma } from '../prisma';

export interface ToolCallTrace {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface BuyerProposalData {
  productId: string;
  productName: string;
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  requestedQuantity: number;
  offeredPrice: number;
  calculatedTotal: number;
  currency: string;
  availableInventory: number;
  inventoryExceeded: boolean;
}

export interface BuyerResult {
  query: string;
  thoughtProcess: string[];
  toolCalls: ToolCallTrace[];
  proposalData?: BuyerProposalData;
  explanation: string;
  status: 'PROPOSAL_GENERATED' | 'NO_MATCH_FOUND' | 'OUT_OF_STOCK' | 'ERROR';
}

export async function executeSearchCatalog(args: {
  query?: string;
  maxPrice?: number;
  eggless?: boolean;
  merchantSlug?: string;
  allowDraftForDemo?: boolean;
}) {
  const whereMerchant: Record<string, unknown> = {};

  // Strict invariant: only merchants ready for transactions
  if (!args.allowDraftForDemo) {
    whereMerchant.transactionStatus = { not: 'NOT_READY' };
  }

  if (args.merchantSlug) {
    whereMerchant.slug = args.merchantSlug;
  }

  const productWhere: Record<string, unknown> = {
    price: { gt: 0 },
  };

  if (!args.allowDraftForDemo) {
    productWhere.priceVerified = true;
    productWhere.inventoryVerified = true;
    productWhere.inventory = { gt: 0 };
  }

  const merchants = await prisma.merchant.findMany({
    where: whereMerchant,
    include: {
      products: {
        where: productWhere,
      },
    },
  });

  // If no merchants found under strict filter and allowDraftForDemo is allowed, check all merchants
  if (merchants.length === 0 && !args.allowDraftForDemo) {
    const totalMerchants = await prisma.merchant.count();
    if (totalMerchants > 0) {
      // Check if merchants exist but are in NOT_READY state
      const unverifiedCount = await prisma.merchant.count({
        where: { transactionStatus: 'NOT_READY' },
      });
      if (unverifiedCount > 0) {
        // Return empty so the caller knows merchants are blocked by readiness gates
        return {
          products: [],
          blockedByReadiness: true,
        };
      }
    }
  }

  const allProducts: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    inventory: number;
    isEggless: boolean | null;
    merchantId: string;
    merchantName: string;
    merchantSlug: string;
  }> = [];

  for (const m of merchants) {
    for (const p of m.products) {
      if (p.price === null) continue;
      const inv = p.inventory ?? 0;

      if (args.eggless !== undefined && p.isEggless !== args.eggless) {
        continue;
      }
      if (args.maxPrice !== undefined && p.price > args.maxPrice) {
        continue;
      }
      if (args.query) {
        const q = args.query.toLowerCase().trim();
        const matchesExactName = p.name.toLowerCase() === q;
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q) || false;
        const isGenericCookieSearch =
          (q === 'cookie' || q === 'cookies') &&
          p.name.toLowerCase().includes('cookie');

        if (
          !matchesExactName &&
          !matchesName &&
          !matchesDesc &&
          !isGenericCookieSearch
        ) {
          continue;
        }
      }

      allProducts.push({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        inventory: inv,
        isEggless: p.isEggless,
        merchantId: m.id,
        merchantName: m.name,
        merchantSlug: m.slug,
      });
    }
  }

  // Sort by search relevance
  if (args.query) {
    const q = args.query.toLowerCase().trim();
    allProducts.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aScore = aName === q ? 3 : aName.includes(q) ? 2 : 1;
      const bScore = bName === q ? 3 : bName.includes(q) ? 2 : 1;
      return bScore - aScore;
    });
  }

  return {
    products: allProducts,
    blockedByReadiness: false,
  };
}

export async function executeProposeOrder(args: {
  productId: string;
  quantity: number;
  agreedPrice: number;
}): Promise<BuyerProposalData> {
  const product = await prisma.product.findUnique({
    where: { id: args.productId },
    include: { merchant: true },
  });

  if (!product) {
    throw new Error(`Product not found with ID: ${args.productId}`);
  }

  const inventory = product.inventory ?? 0;
  const inventoryExceeded = args.quantity > inventory;

  return {
    productId: product.id,
    productName: product.name,
    merchantId: product.merchantId,
    merchantName: product.merchant.name,
    merchantSlug: product.merchant.slug,
    requestedQuantity: args.quantity,
    offeredPrice: args.agreedPrice,
    calculatedTotal: args.quantity * args.agreedPrice,
    currency: product.currency,
    availableInventory: inventory,
    inventoryExceeded,
  };
}

export function parseUserShoppingIntent(query: string): {
  searchTerm: string;
  quantity: number;
  maxPrice?: number;
  eggless?: boolean;
} {
  // 1. Dietary preference extraction
  let eggless: boolean | undefined = undefined;
  if (/eggless|egg-free|no\s*egg/i.test(query)) {
    eggless = true;
  }

  // 2. Price limit extraction (e.g. "under ₹300", "below 300", "max 500")
  let maxPrice: number | undefined = undefined;
  const priceMatch = query.match(
    /(?:under|below|max|less\s+than|[<≤]|budget\s+of)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i
  );
  if (priceMatch) {
    maxPrice = parseFloat(priceMatch[1]);
  }

  // 3. Quantity extraction (e.g. "Buy 2 boxes", "Order 20 boxes", "2 packs")
  let quantity = 1;
  const explicitQtyMatch =
    query.match(
      /(?:buy|order|get|purchase|want)?\s*(\d+)\s*(?:boxes|box|units|packs|items|pieces|cookies)/i
    ) || query.match(/(?:buy|order|get|purchase|want)\s+(\d+)/i);

  if (explicitQtyMatch && parseInt(explicitQtyMatch[1], 10) > 0) {
    const val = parseInt(explicitQtyMatch[1], 10);
    if (val !== maxPrice) {
      const isPricePattern = new RegExp(
        `(?:₹|rs\\.?|inr)\\s*${val}|(?:under|below|max|budget\\s+of|less\\s+than)\\s*(?:₹|rs\\.?|inr)?\\s*${val}`,
        'i'
      ).test(query);
      if (!isPricePattern) {
        quantity = val;
      }
    }
  }

  // 4. Product search term
  let searchTerm = 'cookies';
  if (/signature\s+choco\s+chip/i.test(query)) {
    searchTerm = 'Signature Choco Chip Cookies';
  } else if (/double\s+dark/i.test(query)) {
    searchTerm = 'Double Dark Sea Salt Cookies';
  } else if (/oats|cranberry/i.test(query)) {
    searchTerm = 'Oats & Cranberry Breakfast Cookies';
  } else if (/choco\s*chip/i.test(query)) {
    searchTerm = 'Choco Chip';
  } else if (/cookie/i.test(query)) {
    searchTerm = 'Cookies';
  }

  return {
    searchTerm,
    quantity,
    maxPrice,
    eggless,
  };
}

export async function runAIBuyer(
  userQuery: string,
  options?: { merchantSlug?: string; allowDraftForDemo?: boolean }
): Promise<BuyerResult> {
  const thoughtProcess: string[] = [];
  const toolCalls: ToolCallTrace[] = [];

  thoughtProcess.push(
    `Received autonomous buyer prompt: "${userQuery}". Analyzing purchasing criteria.`
  );

  const intent = parseUserShoppingIntent(userQuery);
  thoughtProcess.push(
    `Extracted parameters: query="${intent.searchTerm}", quantity=${intent.quantity}${
      intent.maxPrice !== undefined ? `, maxPrice=₹${intent.maxPrice}` : ''
    }${intent.eggless !== undefined ? `, eggless=${intent.eggless}` : ''}.`
  );

  // Tool Call 1: search_catalog
  const searchArgs = {
    query: intent.searchTerm,
    maxPrice: intent.maxPrice,
    eggless: intent.eggless,
    merchantSlug: options?.merchantSlug,
    allowDraftForDemo: options?.allowDraftForDemo,
  };

  thoughtProcess.push(
    `Calling tool "search_catalog" to discover verified inventory meeting budget and dietary constraints.`
  );

  const searchResult = await executeSearchCatalog(searchArgs);
  toolCalls.push({
    toolName: 'search_catalog',
    args: searchArgs,
    result: {
      matchedProductsCount: searchResult.products.length,
      products: searchResult.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        inventory: p.inventory,
        isEggless: p.isEggless,
        merchant: p.merchantName,
      })),
      blockedByReadiness: searchResult.blockedByReadiness,
    },
  });

  if (searchResult.blockedByReadiness) {
    thoughtProcess.push(
      `Catalog lookup halted: Target merchant is in 'NOT_READY' state. Invariant gates forbid autonomous buyers from trading with unverified merchants.`
    );
    return {
      query: userQuery,
      thoughtProcess,
      toolCalls,
      explanation:
        "No verified catalog items found: Merchants with status 'NOT_READY' are strictly blocked from AI buyer transactions. Complete merchant remediation to unlock catalog.",
      status: 'NO_MATCH_FOUND',
    };
  }

  if (searchResult.products.length === 0) {
    thoughtProcess.push(
      `Catalog lookup returned 0 matching verified products. No items satisfy the user's constraints.`
    );
    return {
      query: userQuery,
      thoughtProcess,
      toolCalls,
      explanation: `No verified products matched the requested query "${userQuery}". Try adjusting budget or dietary filters.`,
      status: 'NO_MATCH_FOUND',
    };
  }

  // Select candidate
  const candidate = searchResult.products[0];
  thoughtProcess.push(
    `Found ${searchResult.products.length} matching item(s). Selected candidate: "${candidate.name}" (ID: ${candidate.id}) at listed unit price ₹${candidate.price} (${candidate.currency}).`
  );

  if (intent.quantity > candidate.inventory) {
    thoughtProcess.push(
      `⚠️ INVENTORY WARNING: Requested quantity (${intent.quantity}) exceeds currently available verified stock (${candidate.inventory}). Proposing order with requested count to test downstream transaction gate.`
    );
  } else {
    thoughtProcess.push(
      `Stock verified: Requested ${intent.quantity} unit(s) is within available inventory (${candidate.inventory} in stock).`
    );
  }

  // Tool Call 2: propose_order
  thoughtProcess.push(
    `Calling tool "propose_order" with exact product ID "${candidate.id}", quantity: ${intent.quantity}, agreedPrice: ₹${candidate.price}.`
  );

  const proposalData = await executeProposeOrder({
    productId: candidate.id,
    quantity: intent.quantity,
    agreedPrice: candidate.price,
  });

  toolCalls.push({
    toolName: 'propose_order',
    args: {
      productId: candidate.id,
      quantity: intent.quantity,
      agreedPrice: candidate.price,
    },
    result: {
      productId: proposalData.productId,
      productName: proposalData.productName,
      requestedQuantity: proposalData.requestedQuantity,
      offeredPrice: proposalData.offeredPrice,
      calculatedTotal: proposalData.calculatedTotal,
      availableInventory: proposalData.availableInventory,
      inventoryExceeded: proposalData.inventoryExceeded,
    },
  });

  thoughtProcess.push(
    `Transaction proposal successfully formulated: Total ₹${proposalData.calculatedTotal} for ${intent.quantity}x ${candidate.name}.`
  );

  const explanation = proposalData.inventoryExceeded
    ? `Constructed transaction proposal for ${intent.quantity}x "${candidate.name}" totaling ₹${proposalData.calculatedTotal}. Note: Requested quantity (${intent.quantity}) exceeds verified stock (${proposalData.availableInventory}), which will be tested at the transaction gate.`
    : `Successfully constructed transaction proposal for ${intent.quantity}x "${candidate.name}" totaling ₹${proposalData.calculatedTotal} at ₹${candidate.price}/box.`;

  return {
    query: userQuery,
    thoughtProcess,
    toolCalls,
    proposalData,
    explanation,
    status: 'PROPOSAL_GENERATED',
  };
}
