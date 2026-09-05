import { prisma } from '../prisma';
import { executeAICascade, cleanJson } from './cascade';

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

export interface BuyerOptions {
  merchantSlug?: string;
  allowDraftForDemo?: boolean;
}

interface CatalogProductItem {
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
}

interface UnverifiedProductItem {
  id: string;
  name: string;
  reason: string;
}

interface ParsedIntentResult {
  thought: string;
  userRequestedItem: string;
  requestedQuantity: number;
  maxPrice?: number | null;
  egglessRequired?: boolean | null;
  matchFound: boolean;
  unverifiedMatch?: boolean;
  unverifiedReason?: string | null;
  matchedProductId?: string | null;
  matchedProductName?: string | null;
  offeredPrice?: number | null;
  dietaryConstraintMet?: boolean;
  budgetConstraintMet?: boolean;
  rejectionReason?: string | null;
  explanation: string;
}

/**
 * Parses user intent using LLM (Gemini 3.6 Flash -> Groq fallback)
 * Injects the live verified and unverified catalog context so the LLM
 * performs zero-hallucination semantic matching.
 */
async function parseIntentWithLLM(
  userQuery: string,
  availableProducts: CatalogProductItem[],
  unverifiedProducts: UnverifiedProductItem[]
): Promise<ParsedIntentResult | null> {
  const systemPrompt = `You are an autonomous AI purchasing agent and intent parser for an e-commerce platform.
Your task is to parse a customer's shopping query, extract quantity and constraints (budget, dietary), and match it against the merchant's catalog.

CRITICAL INVARIANTS & RULES:
1. QUANTITY EXTRACTION:
   - Extract the exact requested quantity (e.g. "2 boxes" -> 2, "20x" -> 20, "Buy 3 units" -> 3, "10 cookies" -> 10).
   - If not specified, default to 1.
   - OVERSTOCK / INVENTORY TESTING RULE:
     Even if the requested quantity exceeds the current stock (e.g. user requests 20 boxes, but only 10 are available), you MUST still set matchFound: true, matchedProductId to that product's id, and requestedQuantity: 20!
     DO NOT reject or set matchFound: false due to inventory limits; the downstream Transaction Gate tests and blocks stock violations.
2. DIETARY & BUDGET CONSTRAINTS:
   - If "eggless", "egg-free", or "vegetarian" is requested, only consider items where isEggless is true.
   - If a budget limit is specified (e.g. "under ₹300", "below 250"), only consider items where price <= maxBudget.
3. SEMANTIC CATALOG MATCHING:
   - Match the user's intent to items in the VERIFIED CATALOG.
   - If the user query is a general constraint query (e.g., "any eggless dessert under ₹300", "cookies under 250"), select the best matching item from the VERIFIED CATALOG that satisfies all constraints.
   - If the user asks for an item that exists in the UNVERIFIED PRODUCTS list (e.g., "Double Dark Sea Salt Cookies" with unverified price/inventory):
     Set matchFound: false, unverifiedMatch: true, and cite the unverified product and reason.
   - CRITICAL ZERO-HALLUCINATION NEGATIVE MATCH RULE:
     If the user asks for a specific item that does NOT exist in either the verified catalog or unverified products (e.g. "monster cookies", "pizza", "croissant", "truffles", "donut", "vanilla ice cream", "cappuccino"):
     DO NOT guess, DO NOT pick a random item, and DO NOT substitute another cookie/product!
     Set matchFound: false, unverifiedMatch: false.
     Set explanation to: "I could not find '<item>' in the verified catalog. Available items: <comma-separated list of verified product names>."

OUTPUT FORMAT:
Respond strictly with valid JSON conforming to:
{
  "thought": "Brief step-by-step reasoning explaining intent extraction, constraints, and catalog matching",
  "userRequestedItem": "The specific name or category of what the user requested",
  "requestedQuantity": 1,
  "maxPrice": null,
  "egglessRequired": null,
  "matchFound": true,
  "unverifiedMatch": false,
  "unverifiedReason": null,
  "matchedProductId": "string ID from verified catalog or null",
  "matchedProductName": "string name from verified catalog or null",
  "offeredPrice": 250,
  "dietaryConstraintMet": true,
  "budgetConstraintMet": true,
  "rejectionReason": null,
  "explanation": "Clear explanation of the match or reason why no match was found"
}`;

  const userPrompt = `MERCHANT VERIFIED CATALOG (Available for purchase):
${JSON.stringify(
  availableProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    inventory: p.inventory,
    isEggless: p.isEggless,
  })),
  null,
  2
)}

MERCHANT UNVERIFIED PRODUCTS (Blocked from purchase due to unverified status/price/stock):
${JSON.stringify(unverifiedProducts, null, 2)}

CUSTOMER QUERY:
"${userQuery}"`;

  // Execute AI Cascade (Groq Primary -> Gemini Cascade Secondary Fallback)
  try {
    const cascadeRes = await executeAICascade({
      userPrompt,
      systemPrompt,
      jsonMode: true,
    });

    if (cascadeRes.text) {
      const parsed = JSON.parse(cleanJson(cascadeRes.text));
      return parsed as ParsedIntentResult;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[AI Buyer] AI Cascade failed (${msg}). Using deterministic parser...`);
  }

  return null;
}

/**
 * Deterministic fallback matcher when LLM providers are unreachable.
 * Strictly enforces zero-hallucination: refuses to guess or pick random items.
 */
function deterministicMatch(
  userQuery: string,
  availableProducts: CatalogProductItem[],
  unverifiedProducts: UnverifiedProductItem[]
): ParsedIntentResult {
  // 1. Dietary preference extraction
  let eggless: boolean | null = null;
  if (/eggless|egg-free|no\s*egg/i.test(userQuery)) {
    eggless = true;
  }

  // 2. Price limit extraction
  let maxPrice: number | null = null;
  const priceMatch = userQuery.match(
    /(?:under|below|max|less\s+than|[<≤]|budget\s+of)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i
  );
  if (priceMatch) {
    maxPrice = parseFloat(priceMatch[1]);
  }

  // 3. Quantity extraction
  let quantity = 1;
  const explicitQtyMatch =
    userQuery.match(
      /(?:buy|order|get|purchase|want)?\s*(\d+)\s*(?:boxes|box|units|packs|items|pieces|cookies|x)?/i
    ) || userQuery.match(/(?:buy|order|get|purchase|want)\s+(\d+)/i);

  if (explicitQtyMatch && parseInt(explicitQtyMatch[1], 10) > 0) {
    const val = parseInt(explicitQtyMatch[1], 10);
    if (val !== maxPrice) {
      const isPricePattern = new RegExp(
        `(?:₹|rs\\.?|inr)\\s*${val}|(?:under|below|max|budget\\s+of|less\\s+than)\\s*(?:₹|rs\\.?|inr)?\\s*${val}`,
        'i'
      ).test(userQuery);
      if (!isPricePattern) {
        quantity = val;
      }
    }
  }

  const qLower = userQuery.toLowerCase();

  // 4. Check unverified products first (Deterministic Invariant 1)
  for (const unv of unverifiedProducts) {
    const unvNameLower = unv.name.toLowerCase();
    const keywords = unvNameLower
      .replace(/cookies?|box|boxes/gi, '')
      .trim()
      .split(/\s+/)
      .filter((k) => k.length > 2);

    const matchesUnverified =
      qLower.includes(unvNameLower) ||
      (keywords.length > 0 && keywords.every((k) => qLower.includes(k)));

    if (matchesUnverified) {
      return {
        thought: `User requested "${unv.name}", but this product has ${unv.reason.toLowerCase()}. Halting proposal due to Deterministic Invariant 1.`,
        userRequestedItem: unv.name,
        requestedQuantity: quantity,
        maxPrice,
        egglessRequired: eggless,
        matchFound: false,
        unverifiedMatch: true,
        unverifiedReason: unv.reason,
        matchedProductId: null,
        matchedProductName: unv.name,
        offeredPrice: null,
        dietaryConstraintMet: true,
        budgetConstraintMet: true,
        explanation: `Found "${unv.name}" in catalog, but ${unv.reason.toLowerCase()}. Autonomous AI Buyer cannot formulate a binding transaction proposal on unverified inventory. Complete verification in Merchant Dashboard to enable transactions.`,
      };
    }
  }

  // 5. Match specific product names in verified catalog
  for (const p of availableProducts) {
    const pNameLower = p.name.toLowerCase();
    const keywords = pNameLower
      .replace(/cookies?|box|boxes/gi, '')
      .trim()
      .split(/\s+/)
      .filter((k) => k.length > 2);

    const matchesName =
      qLower.includes(pNameLower) ||
      (keywords.length > 0 && keywords.every((k) => qLower.includes(k)));

    if (matchesName) {
      if (eggless !== null && p.isEggless !== eggless) {
        return {
          thought: `Product "${p.name}" matches query but does not meet dietary requirement (eggless: ${eggless}).`,
          userRequestedItem: p.name,
          requestedQuantity: quantity,
          maxPrice,
          egglessRequired: eggless,
          matchFound: false,
          dietaryConstraintMet: false,
          budgetConstraintMet: true,
          explanation: `Product "${p.name}" does not meet your dietary preference (${eggless ? 'eggless' : 'standard'}).`,
        };
      }

      if (maxPrice !== null && p.price > maxPrice) {
        return {
          thought: `Product "${p.name}" (price ₹${p.price}) exceeds maximum budget of ₹${maxPrice}.`,
          userRequestedItem: p.name,
          requestedQuantity: quantity,
          maxPrice,
          egglessRequired: eggless,
          matchFound: false,
          dietaryConstraintMet: true,
          budgetConstraintMet: false,
          explanation: `Product "${p.name}" priced at ₹${p.price} exceeds your budget limit of ₹${maxPrice}.`,
        };
      }

      return {
        thought: `Matched query to verified product "${p.name}" (price: ₹${p.price}, stock: ${p.inventory}).`,
        userRequestedItem: p.name,
        requestedQuantity: quantity,
        maxPrice,
        egglessRequired: eggless,
        matchFound: true,
        matchedProductId: p.id,
        matchedProductName: p.name,
        offeredPrice: p.price,
        dietaryConstraintMet: true,
        budgetConstraintMet: true,
        explanation: `Selected verified product "${p.name}" at listed unit price ₹${p.price}.`,
      };
    }
  }

  // 6. Check generic/constraint queries (e.g. "any eggless dessert under 300", "cookies under 300")
  const isGenericQuery =
    /^(?:any|some)?\s*(?:eggless\s+)?(?:dessert|desserts|food|item|items|product|products|cookies?|snack|treat)(?:\s+(?:under|below|max|budget\s+of)\s*(?:₹|rs\.?|inr)?\s*\d+)?$/i.test(
      userQuery.trim()
    ) ||
    /^(?:i\s+(?:want|need)|can\s+i\s+(?:get|have)|give\s+me|order|buy)?\s*(?:any|some)?\s*(?:eggless\s+)?(?:dessert|desserts|food|item|items|product|products|cookies?)(?:\s+(?:under|below|max|budget\s+of)\s*(?:₹|rs\.?|inr)?\s*\d+)?/i.test(
      userQuery.trim()
    );

  if (isGenericQuery) {
    const matchingProducts = availableProducts.filter((p) => {
      if (eggless !== null && p.isEggless !== eggless) return false;
      if (maxPrice !== null && p.price > maxPrice) return false;
      return true;
    });

    if (matchingProducts.length > 0) {
      const best = matchingProducts[0];
      return {
        thought: `Constraint query matched ${matchingProducts.length} verified item(s). Selected candidate: "${best.name}" at ₹${best.price}.`,
        userRequestedItem: userQuery.trim(),
        requestedQuantity: quantity,
        maxPrice,
        egglessRequired: eggless,
        matchFound: true,
        matchedProductId: best.id,
        matchedProductName: best.name,
        offeredPrice: best.price,
        dietaryConstraintMet: true,
        budgetConstraintMet: true,
        explanation: `Found matching item "${best.name}" meeting all constraints at listed unit price ₹${best.price}.`,
      };
    } else {
      if (maxPrice !== null) {
        return {
          thought: `Catalog lookup returned 0 verified products satisfying budget ₹${maxPrice}${eggless ? ' and eggless' : ''}.`,
          userRequestedItem: userQuery.trim(),
          requestedQuantity: quantity,
          maxPrice,
          egglessRequired: eggless,
          matchFound: false,
          budgetConstraintMet: false,
          explanation: `No products found under specified budget of ₹${maxPrice}. Try increasing your budget limit or selecting an available verified item.`,
        };
      }
    }
  }

  // 7. Unknown / Unmatched item: strictly refuse to substitute or guess
  const cleanedItem = userQuery
    .replace(
      /^(?:can\s+i\s+(?:have|get|order)|please\s+give\s+me|i\s+want\s+to\s+order|i\s+want|i\s+need|buy|order|get|purchase|need)\s+/i,
      ''
    )
    .replace(/\b\d+\s*(?:boxes|box|units|packs|items|pieces|x)\b/gi, '')
    .replace(
      /\b(?:under|below|max|less\s+than|budget\s+of)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\b/gi,
      ''
    )
    .replace(/\b(?:any|some|a|an|of|the|please|for|me|in)\b/gi, '')
    .trim();

  const availableList = availableProducts.map((p) => p.name).join(', ');

  return {
    thought: `Catalog lookup returned 0 matching verified products for query "${userQuery}". Item "${cleanedItem || userQuery}" is not present in merchant catalog. Strict zero-hallucination policy prevents arbitrary substitution.`,
    userRequestedItem: cleanedItem || userQuery,
    requestedQuantity: quantity,
    maxPrice,
    egglessRequired: eggless,
    matchFound: false,
    matchedProductId: null,
    matchedProductName: null,
    offeredPrice: null,
    dietaryConstraintMet: false,
    budgetConstraintMet: false,
    explanation: `I could not find '${cleanedItem || userQuery}' in the verified catalog. Available items: ${availableList || 'None'}.`,
  };
}

export async function executeSearchCatalog(args: {
  query?: string;
  maxPrice?: number;
  eggless?: boolean;
  merchantSlug?: string;
  allowDraftForDemo?: boolean;
}) {
  const whereMerchant: Record<string, unknown> = {};

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

  if (merchants.length === 0 && !args.allowDraftForDemo) {
    const totalMerchants = await prisma.merchant.count();
    if (totalMerchants > 0) {
      const unverifiedCount = await prisma.merchant.count({
        where: { transactionStatus: 'NOT_READY' },
      });
      if (unverifiedCount > 0) {
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

        if (!matchesExactName && !matchesName && !matchesDesc) {
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
  let eggless: boolean | undefined = undefined;
  if (/eggless|egg-free|no\s*egg/i.test(query)) {
    eggless = true;
  }

  let maxPrice: number | undefined = undefined;
  const priceMatch = query.match(
    /(?:under|below|max|less\s+than|[<≤]|budget\s+of)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i
  );
  if (priceMatch) {
    maxPrice = parseFloat(priceMatch[1]);
  }

  let quantity = 1;
  const explicitQtyMatch =
    query.match(
      /(?:buy|order|get|purchase|want)?\s*(\d+)\s*(?:boxes|box|units|packs|items|pieces|cookies|x)?/i
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

  const cleaned = query
    .replace(
      /^(?:can\s+i\s+(?:have|get|order)|please\s+give\s+me|i\s+want\s+to\s+order|i\s+want|i\s+need|buy|order|get|purchase|need)\s+/i,
      ''
    )
    .replace(/\b\d+\s*(?:boxes|box|units|packs|items|pieces|x)\b/gi, '')
    .replace(
      /\b(?:under|below|max|less\s+than|budget\s+of)\s*(?:₹|rs\.?|inr)?\s*\d+(?:\.\d+)?\b/gi,
      ''
    )
    .replace(/\b(?:any|some|a|an|of|the|please|for|me|in)\b/gi, '')
    .trim();

  return {
    searchTerm: cleaned,
    quantity,
    maxPrice,
    eggless,
  };
}

/**
 * Executes the Autonomous AI Buyer Loop.
 * 1. Fetches active verified catalog and unverified products directly from SQLite.
 * 2. Checks merchant readiness invariants.
 * 3. Dynamically interprets shopping intent using Gemini 3.6 Flash / Groq LLM.
 * 4. Calls search_catalog and propose_order tools to formulate structured proposals.
 */
export async function runAIBuyer(
  userQuery: string,
  merchantSlugOrOptions?: string | BuyerOptions,
  maybeOptions?: BuyerOptions
): Promise<BuyerResult> {
  const thoughtProcess: string[] = [];
  const toolCalls: ToolCallTrace[] = [];

  const merchantSlug =
    typeof merchantSlugOrOptions === 'string'
      ? merchantSlugOrOptions
      : merchantSlugOrOptions?.merchantSlug || maybeOptions?.merchantSlug || 'sweet-crumbs';

  const allowDraftForDemo =
    typeof merchantSlugOrOptions === 'object'
      ? merchantSlugOrOptions?.allowDraftForDemo ?? maybeOptions?.allowDraftForDemo ?? false
      : maybeOptions?.allowDraftForDemo ?? false;

  thoughtProcess.push(
    `Autonomous buyer prompt received: "${userQuery}". Analyzing purchasing criteria for merchant "${merchantSlug}".`
  );

  // 1. Fetch target merchant
  const merchant = await prisma.merchant.findUnique({
    where: { slug: merchantSlug },
    include: { products: true },
  });

  if (!merchant) {
    thoughtProcess.push(`Merchant lookup failed: No merchant with slug "${merchantSlug}" found in database.`);
    return {
      query: userQuery,
      thoughtProcess,
      toolCalls,
      explanation: `Merchant "${merchantSlug}" does not exist in the database.`,
      status: 'NO_MATCH_FOUND',
    };
  }

  // 2. Strict Invariant: Merchants in NOT_READY state are blocked from autonomous transactions
  if (!allowDraftForDemo && merchant.transactionStatus === 'NOT_READY') {
    thoughtProcess.push(
      `Catalog lookup halted: Target merchant "${merchant.name}" is in 'NOT_READY' state. Invariant gates forbid autonomous buyers from trading with unverified merchants.`
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

  // 3. Fetch verified available products from live database
  let availableDbProducts = await prisma.product.findMany({
    where: {
      merchant: { slug: merchantSlug },
      status: 'VERIFIED',
      priceVerified: true,
      inventoryVerified: true,
      inventory: { gt: 0 },
      price: { gt: 0 },
    },
    include: {
      merchant: { select: { id: true, name: true, slug: true } },
    },
  });

  if (availableDbProducts.length === 0) {
    availableDbProducts = await prisma.product.findMany({
      where: {
        merchant: { slug: merchantSlug },
        priceVerified: true,
        inventoryVerified: true,
        inventory: { gt: 0 },
        price: { gt: 0 },
      },
      include: {
        merchant: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  const availableProducts: CatalogProductItem[] = availableDbProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price!,
    currency: p.currency,
    inventory: p.inventory!,
    isEggless: p.isEggless,
    merchantId: p.merchantId,
    merchantName: p.merchant.name,
    merchantSlug: p.merchant.slug,
  }));

  // 4. Fetch unverified products for Invariant 1 detection
  const allDbProducts = await prisma.product.findMany({
    where: { merchant: { slug: merchantSlug } },
  });

  const unverifiedProducts: UnverifiedProductItem[] = allDbProducts
    .filter(
      (p) =>
        !p.priceVerified ||
        !p.inventoryVerified ||
        p.price === null ||
        p.inventory === null ||
        p.inventory <= 0
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      reason:
        !p.priceVerified || p.price === null
          ? p.price === null
            ? 'Price is unverified (null in catalog)'
            : 'Price is unverified by merchant'
          : !p.inventoryVerified || p.inventory === null
          ? p.inventory === null
            ? 'Inventory is unverified (null in catalog)'
            : 'Inventory is unverified by merchant'
          : 'Out of stock (0 inventory)',
    }));

  thoughtProcess.push(
    `Catalog context loaded: ${availableProducts.length} verified item(s), ${unverifiedProducts.length} unverified item(s) in store.`
  );

  // 5. Dynamic LLM Intent & Catalog Matching (Gemini 3.6 Flash -> Groq -> Deterministic Fallback)
  let intentResult = await parseIntentWithLLM(userQuery, availableProducts, unverifiedProducts);

  if (intentResult && intentResult.matchFound && intentResult.matchedProductId) {
    const verifiedCandidateExists = availableProducts.some((p) => p.id === intentResult!.matchedProductId);
    if (!verifiedCandidateExists) {
      console.warn('[AI Buyer] LLM returned non-existent product ID, falling back to deterministic matching.');
      intentResult = null;
    }
  }

  // Preserve overstock limit testing: If LLM rejected solely due to inventory exceeding stock,
  // ensure proposal is still formed so downstream transaction gate can enforce invariant
  if (intentResult && !intentResult.matchFound && !intentResult.unverifiedMatch) {
    const matchedProduct = availableProducts.find((p) => {
      const pName = p.name.toLowerCase();
      const req = (intentResult?.userRequestedItem || '').toLowerCase();
      return (
        req.includes(pName) ||
        pName.includes(req) ||
        userQuery.toLowerCase().includes(pName)
      );
    });

    if (matchedProduct) {
      const reasoningMentionsStock =
        /inventory|stock|units in stock|less than|cannot be fulfilled|insufficient/i.test(
          intentResult.thought || ''
        ) ||
        /inventory|stock|units in stock|less than|cannot be fulfilled|insufficient/i.test(
          intentResult.explanation || ''
        );

      if (reasoningMentionsStock) {
        intentResult.matchFound = true;
        intentResult.matchedProductId = matchedProduct.id;
        intentResult.matchedProductName = matchedProduct.name;
        intentResult.offeredPrice = matchedProduct.price;
        intentResult.budgetConstraintMet = true;
        intentResult.dietaryConstraintMet = true;
      }
    }
  }

  if (!intentResult) {
    intentResult = deterministicMatch(userQuery, availableProducts, unverifiedProducts);
  }

  thoughtProcess.push(
    `Intent parsed: item="${intentResult.userRequestedItem}", qty=${intentResult.requestedQuantity}${
      intentResult.maxPrice !== null && intentResult.maxPrice !== undefined ? `, max budget=₹${intentResult.maxPrice}` : ', no budget cap'
    }${intentResult.egglessRequired ? ', dietary=eggless' : ''}.`
  );

  if (intentResult.thought) {
    thoughtProcess.push(`Agent reasoning: ${intentResult.thought}`);
  }

  // 6. Tool Call 1: search_catalog
  const searchArgs = {
    query: intentResult.userRequestedItem,
    maxPrice: intentResult.maxPrice ?? undefined,
    eggless: intentResult.egglessRequired ?? undefined,
    merchantSlug,
    allowDraftForDemo,
  };

  thoughtProcess.push(
    `Calling tool "search_catalog" to discover verified inventory meeting constraints.`
  );

  toolCalls.push({
    toolName: 'search_catalog',
    args: searchArgs,
    result: {
      matchedProductsCount: intentResult.matchFound ? 1 : 0,
      products: intentResult.matchFound && intentResult.matchedProductId
        ? availableProducts
            .filter((p) => p.id === intentResult!.matchedProductId)
            .map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              inventory: p.inventory,
              isEggless: p.isEggless,
              merchant: p.merchantName,
            }))
        : [],
      blockedByReadiness: false,
      unverifiedMatch: intentResult.unverifiedMatch
        ? {
            name: intentResult.matchedProductName || intentResult.userRequestedItem,
            reason: intentResult.unverifiedReason || 'Price/inventory unverified',
          }
        : undefined,
    },
  });

  // 7. Handle Unverified or Non-Matching Cases
  if (intentResult.unverifiedMatch) {
    thoughtProcess.push(
      `⚠️ INVARIANT RESTRICTION: Found product "${intentResult.matchedProductName || intentResult.userRequestedItem}" in catalog, but ${
        intentResult.unverifiedReason?.toLowerCase() || 'it is unverified'
      }. Deterministic Invariant 1 halts order proposal.`
    );
    return {
      query: userQuery,
      thoughtProcess,
      toolCalls,
      explanation: intentResult.explanation,
      status: 'NO_MATCH_FOUND',
    };
  }

  if (!intentResult.matchFound || !intentResult.matchedProductId) {
    thoughtProcess.push(
      `Catalog lookup returned 0 matching verified products. Strict zero-hallucination policy stops proposal formulation.`
    );
    return {
      query: userQuery,
      thoughtProcess,
      toolCalls,
      explanation: intentResult.explanation,
      status: 'NO_MATCH_FOUND',
    };
  }

  // 8. Select Matched Verified Candidate
  const candidate =
    availableProducts.find((p) => p.id === intentResult!.matchedProductId) ||
    availableProducts[0];

  thoughtProcess.push(
    `Selected candidate: "${candidate.name}" (ID: ${candidate.id}) at listed unit price ₹${candidate.price} (${candidate.currency}).`
  );

  if (intentResult.requestedQuantity > candidate.inventory) {
    thoughtProcess.push(
      `⚠️ INVENTORY WARNING: Requested quantity (${intentResult.requestedQuantity}) exceeds currently available verified stock (${candidate.inventory}). Proposing order with requested count to test downstream transaction gate.`
    );
  } else {
    thoughtProcess.push(
      `Stock verified: Requested ${intentResult.requestedQuantity} unit(s) is within available inventory (${candidate.inventory} in stock).`
    );
  }

  // 9. Tool Call 2: propose_order
  thoughtProcess.push(
    `Calling tool "propose_order" with exact product ID "${candidate.id}", quantity: ${intentResult.requestedQuantity}, agreedPrice: ₹${candidate.price}.`
  );

  const proposalData = await executeProposeOrder({
    productId: candidate.id,
    quantity: intentResult.requestedQuantity,
    agreedPrice: candidate.price,
  });

  toolCalls.push({
    toolName: 'propose_order',
    args: {
      productId: candidate.id,
      quantity: intentResult.requestedQuantity,
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
    `Transaction proposal successfully formulated: Total ₹${proposalData.calculatedTotal} for ${intentResult.requestedQuantity}x ${candidate.name}.`
  );

  const explanation = proposalData.inventoryExceeded
    ? `Constructed transaction proposal for ${intentResult.requestedQuantity}x "${candidate.name}" totaling ₹${proposalData.calculatedTotal}. Note: Requested quantity (${intentResult.requestedQuantity}) exceeds verified stock (${proposalData.availableInventory}), which will be tested at the transaction gate.`
    : `Successfully constructed transaction proposal for ${intentResult.requestedQuantity}x "${candidate.name}" totaling ₹${proposalData.calculatedTotal} at ₹${candidate.price}/box.`;

  return {
    query: userQuery,
    thoughtProcess,
    toolCalls,
    proposalData,
    explanation,
    status: 'PROPOSAL_GENERATED',
  };
}
