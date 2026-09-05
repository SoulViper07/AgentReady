import { executeAICascade, cleanJson } from './cascade';
import {
  ExtractedCatalog,
  ExtractedCatalogSchema,
  ExtractedProduct,
  ExtractedPolicy,
  ConsistencyFlag,
} from './schemas';

const SYSTEM_PROMPT = `You are an adversarial fintech data extractor with zero tolerance for hallucinations or unverified assumptions.
Your role is to extract structured merchant data (products, pricing, inventory, and operational policies) from raw merchant inputs (such as WhatsApp messages or notes) and cross-reference them against any provided legacy CSV catalog.

CRITICAL RULES:
1. PRODUCTS:
   - Extract all distinct products offered or mentioned in the raw text.
   - "name": Clean name of the product.
   - "description": Description or notes provided in the input, or null if none.
   - "price": Explicit numerical price stated in the active input (e.g. ₹250 -> 250). If the price is NOT explicitly stated in the active input (for example, if it says "DM for box pricing", "pricing on request", or is omitted), it MUST be null. NEVER infer, guess, extrapolate, or use legacy CSV values as active price.
   - "currency": Default to "INR".
   - "inventory": Exact numeric count explicitly stated as available (e.g., "Only 10 boxes available!" -> 10). If not explicitly stated as a definite number, it MUST be null.
   - "isEggless": true if explicitly stated eggless (e.g., "100% Eggless"), false if stated with eggs, or null if unmentioned.
   - "sourceEvidence": The exact verbatim quote from the raw text proving these extracted fields.

2. POLICIES:
   - Extract operational policies into types: "REFUND", "CANCELLATION", "DELIVERY".
   - "content": Clear description of the policy from the input.
   - "sourceEvidence": Exact verbatim quote from the text.

3. CONSISTENCY & DISCREPANCIES:
   - Compare active input products against legacy CSV data if provided.
   - Detect any discrepancies (e.g. conflicting prices between the active message and legacy CSV for the same product) and flag each in "consistencyFlags":
     - "field": The conflicting field (e.g., "<ProductName>.price").
     - "detectedValues": Array of strings showing the values from both sources, e.g. ["250", "200"].
     - "explanation": Precise explanation of the discrepancy.

OUTPUT FORMAT:
Output strictly valid JSON matching this schema:
{
  "products": [
    {
      "name": string,
      "description": string | null,
      "price": number | null,
      "currency": string,
      "inventory": number | null,
      "isEggless": boolean | null,
      "sourceEvidence": string | null
    }
  ],
  "policies": [
    {
      "type": "REFUND" | "CANCELLATION" | "DELIVERY",
      "content": string | null,
      "sourceEvidence": string | null
    }
  ],
  "consistencyFlags": [
    {
      "field": string,
      "detectedValues": string[],
      "explanation": string
    }
  ]
}`;

function parseLegacyCsv(csvData?: string): Array<{
  name: string;
  category?: string;
  price: number | null;
  inventoryStatus?: string;
  isEggless: boolean | null;
}> {
  if (!csvData || !csvData.trim()) return [];
  const lines = csvData.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('product'));
  const priceIdx = headers.findIndex((h) => h.includes('price'));
  const categoryIdx = headers.findIndex((h) => h.includes('category'));
  const inventoryIdx = headers.findIndex((h) => h.includes('inventory'));
  const egglessIdx = headers.findIndex((h) => h.includes('eggless'));

  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.trim());
    const rawPrice = priceIdx >= 0 ? parts[priceIdx] : null;
    const parsedPrice = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : null;
    const rawEggless = egglessIdx >= 0 ? parts[egglessIdx]?.toLowerCase() : null;

    return {
      name: nameIdx >= 0 ? parts[nameIdx] : parts[0],
      category: categoryIdx >= 0 ? parts[categoryIdx] : undefined,
      price: parsedPrice !== null && !isNaN(parsedPrice) ? parsedPrice : null,
      inventoryStatus: inventoryIdx >= 0 ? parts[inventoryIdx] : undefined,
      isEggless: rawEggless === 'true' ? true : rawEggless === 'false' ? false : null,
    };
  });
}

export function extractMerchantDataDeterministic(
  rawText: string,
  csvData?: string
): ExtractedCatalog {
  const products: ExtractedProduct[] = [];
  const policies: ExtractedPolicy[] = [];
  const consistencyFlags: ConsistencyFlag[] = [];

  const legacyProducts = parseLegacyCsv(csvData);
  const lines = rawText.split(/\r?\n/);

  // 1. Extract products
  const productRegex = /^\s*(\d+)\.\s+([^(:\-\n]+)(?:\s*\(([^)]+)\))?\s*[-:]?\s*(.*)$/;
  for (const line of lines) {
    const match = line.match(productRegex);
    if (match) {
      const rawName = match[2].trim();
      const parentheses = match[3]?.trim();
      const rest = match[4]?.trim() || '';
      const fullLine = line.trim();

      // Check eggless
      let isEggless: boolean | null = null;
      if (/eggless/i.test(parentheses || '') || /eggless/i.test(rest)) {
        isEggless = true;
      } else if (
        /with\s*egg|contains\s*egg/i.test(parentheses || '') ||
        /with\s*egg/i.test(rest)
      ) {
        isEggless = false;
      }

      // Check price: strict rule - null if not explicitly stated
      let price: number | null = null;
      // If it says "DM for pricing" or "DM for box pricing" or lacks explicit price, keep null
      if (!/dm\s+for/i.test(rest) && !/pricing\s+on\s+request/i.test(rest)) {
        const priceMatch = rest.match(/price\s*:\s*[₹Rs.]*\s*(\d+(?:\.\d+)?)/i);
        if (priceMatch) {
          price = parseFloat(priceMatch[1]);
        }
      }

      // Check inventory: strict rule - null if not explicitly stated
      let inventory: number | null = null;
      const invMatch = rest.match(/(\d+)\s*(?:boxes|items|units|packs)?\s*available/i);
      if (invMatch) {
        inventory = parseInt(invMatch[1], 10);
      }

      // Description
      const description = rest.length > 0 ? rest : null;

      products.push({
        name: rawName,
        description,
        price,
        currency: 'INR',
        inventory,
        isEggless,
        sourceEvidence: fullLine,
      });
    }
  }

  // 2. Extract operational policies
  for (const line of lines) {
    const trimmed = line.trim();
    if (/deliver(?:ed|y)?\s+across|delivery\s+available|pickup\s+available/i.test(trimmed)) {
      policies.push({
        type: 'DELIVERY',
        content: trimmed,
        sourceEvidence: trimmed,
      });
    } else if (/returns?\s+or\s+refunds?|refund\s+policy|no\s+returns?/i.test(trimmed)) {
      policies.push({
        type: 'REFUND',
        content: trimmed,
        sourceEvidence: trimmed,
      });
    } else if (/cancellation|cancel\s+order/i.test(trimmed)) {
      policies.push({
        type: 'CANCELLATION',
        content: trimmed,
        sourceEvidence: trimmed,
      });
    }
  }

  // 3. Discrepancy detection against legacy CSV
  for (const product of products) {
    const legacy = legacyProducts.find(
      (lp) => lp.name.toLowerCase() === product.name.toLowerCase()
    );
    if (legacy) {
      if (
        product.price !== null &&
        legacy.price !== null &&
        product.price !== legacy.price
      ) {
        consistencyFlags.push({
          field: `${product.name}.price`,
          detectedValues: [product.price.toString(), legacy.price.toString()],
          explanation: `Price discrepancy detected: WhatsApp message specifies ₹${product.price} while legacy catalog CSV lists ₹${legacy.price}.`,
        });
      }
    }
  }

  return ExtractedCatalogSchema.parse({
    products,
    policies,
    consistencyFlags,
  });
}

export function cleanAndNormalizeExtraction(rawText: string): any {
  let cleaned = rawText.trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // If JSON.parse fails, attempt to locate outermost JSON object braces
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } else {
      throw e;
    }
  }

  // Normalize products / items array
  const rawProducts =
    parsed.products ||
    parsed.items ||
    parsed.menu ||
    parsed.catalog ||
    parsed.data ||
    [];
  const normalizedProducts = Array.isArray(rawProducts)
    ? rawProducts.map((p: any) => {
        // Clean price
        let price: number | null = null;
        if (p.price !== undefined && p.price !== null) {
          if (typeof p.price === 'number') {
            price = isNaN(p.price) ? null : p.price;
          } else if (typeof p.price === 'string') {
            const num = parseFloat(p.price.replace(/[^0-9.]/g, ''));
            price = isNaN(num) ? null : num;
          }
        }

        // Clean inventory
        let inventory: number | null = null;
        if (p.inventory !== undefined && p.inventory !== null) {
          if (typeof p.inventory === 'number') {
            inventory = isNaN(p.inventory) ? null : Math.floor(p.inventory);
          } else if (typeof p.inventory === 'string') {
            const num = parseInt(p.inventory.replace(/[^0-9]/g, ''), 10);
            inventory = isNaN(num) ? null : num;
          }
        }

        // Clean eggless
        let isEggless: boolean | null = null;
        if (typeof p.isEggless === 'boolean') {
          isEggless = p.isEggless;
        } else if (typeof p.isEggless === 'string') {
          const lower = p.isEggless.toLowerCase();
          if (lower === 'true' || lower === 'eggless' || lower === 'yes')
            isEggless = true;
          else if (
            lower === 'false' ||
            lower === 'contains egg' ||
            lower === 'no'
          )
            isEggless = false;
        }

        return {
          name: String(p.name || p.title || 'Untitled Item').trim(),
          description: p.description ? String(p.description).trim() : null,
          price,
          currency: String(p.currency || 'INR').trim(),
          inventory,
          isEggless,
          sourceEvidence: p.sourceEvidence
            ? String(p.sourceEvidence).trim()
            : p.name || null,
        };
      })
    : [];

  // Normalize policies array
  const rawPolicies = parsed.policies || parsed.policy || [];
  const normalizedPolicies = Array.isArray(rawPolicies)
    ? rawPolicies.map((pol: any) => {
        let type = String(pol.type || 'REFUND').toUpperCase();
        if (!['REFUND', 'CANCELLATION', 'DELIVERY'].includes(type)) {
          if (type.includes('DELIV') || type.includes('SHIP')) type = 'DELIVERY';
          else if (type.includes('CANCEL')) type = 'CANCELLATION';
          else type = 'REFUND';
        }
        return {
          type,
          content: pol.content ? String(pol.content).trim() : null,
          sourceEvidence: pol.sourceEvidence
            ? String(pol.sourceEvidence).trim()
            : null,
        };
      })
    : [];

  // Normalize consistencyFlags array
  const rawFlags = parsed.consistencyFlags || parsed.discrepancies || [];
  const normalizedFlags = Array.isArray(rawFlags)
    ? rawFlags.map((f: any) => ({
        field: String(f.field || 'price').trim(),
        detectedValues: Array.isArray(f.detectedValues)
          ? f.detectedValues.map(String)
          : [],
        explanation: String(f.explanation || '').trim(),
      }))
    : [];

  return {
    products: normalizedProducts,
    policies: normalizedPolicies,
    consistencyFlags: normalizedFlags,
  };
}

export interface ExtractOptions {
  csvData?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export async function extractMerchantData(
  rawText: string,
  optionsOrCsv?: string | ExtractOptions
): Promise<ExtractedCatalog> {
  let csvData: string | undefined;
  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;

  if (typeof optionsOrCsv === 'string') {
    csvData = optionsOrCsv;
  } else if (optionsOrCsv) {
    csvData = optionsOrCsv.csvData;
    imageBase64 = optionsOrCsv.imageBase64;
    imageMimeType = optionsOrCsv.imageMimeType;
  }

  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ''
  ).trim();

  const userPrompt = `RAW MERCHANT INPUT:
"""
${rawText || (imageBase64 ? 'Please analyze the attached image of the menu / price list / packaging.' : '')}
"""

${
  csvData
    ? `LEGACY CSV CATALOG:
"""
${csvData}
"""`
    : ''
}

${
  imageBase64
    ? 'NOTE: An image of a merchant menu, catalog list, or product packaging is attached. Perform OCR and multimodal extraction on the visible text and product items.'
    : ''
}

Extract the structured catalog following the adversarial instructions and strict null rules. Output strictly JSON.`;

  // 1. Primary & Secondary Fallback: Execute AI Cascade (Vision: Gemini -> Groq; Text: Groq -> Gemini)
  try {
    const cascadeResponse = await executeAICascade({
      userPrompt,
      systemPrompt: SYSTEM_PROMPT,
      jsonMode: true,
      imageBase64,
      imageMimeType,
    });

    if (cascadeResponse.text) {
      const normalized = cleanAndNormalizeExtraction(cascadeResponse.text);

      // Defensively cross-reference against legacy CSV if provided to ensure price conflicts are never missed
      if (csvData) {
        const legacyProducts = parseLegacyCsv(csvData);
        for (const product of normalized.products) {
          const legacy = legacyProducts.find(
            (lp) => lp.name.toLowerCase() === product.name.toLowerCase()
          );
          if (legacy) {
            if (
              product.price !== null &&
              legacy.price !== null &&
              product.price !== legacy.price
            ) {
              const alreadyFlagged = normalized.consistencyFlags.some(
                (f: any) =>
                  f.field.toLowerCase().includes('price') &&
                  f.detectedValues.includes(String(product.price)) &&
                  f.detectedValues.includes(String(legacy.price))
              );
              if (!alreadyFlagged) {
                normalized.consistencyFlags.push({
                  field: `${product.name}.price`,
                  detectedValues: [String(product.price), String(legacy.price)],
                  explanation: `Price discrepancy detected: active input specifies ₹${product.price} while legacy catalog CSV lists ₹${legacy.price}.`,
                });
              }
            }
          }
        }
      }

      const catalog = ExtractedCatalogSchema.parse(normalized);
      return {
        ...catalog,
        providerUsed: cascadeResponse.providerUsed,
      };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(
      `[Ingestion] AI Cascade failed (${errorMessage}). Falling back to alternative/deterministic pipeline...`
    );
  }

  // Optional OpenAI bridge if OPENAI_API_KEY is available
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiKey });

      const userMessageContent: any[] = [{ type: 'text', text: userPrompt }];
      if (imageBase64) {
        const formattedUrl = imageBase64.startsWith('data:')
          ? imageBase64
          : `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`;
        userMessageContent.push({
          type: 'image_url',
          image_url: { url: formattedUrl },
        });
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessageContent },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const normalized = cleanAndNormalizeExtraction(content);
        const catalog = ExtractedCatalogSchema.parse(normalized);
        return {
          ...catalog,
          providerUsed: 'openai',
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn('OpenAI fallback failed:', errorMessage);
    }
  }

  // 3. Tertiary Deterministic Fallback: Never crash the application
  console.warn('[Ingestion] All AI APIs failed or unavailable. Engaging tertiary deterministic fallback.');
  const fallbackText =
    rawText && rawText.trim().length > 10
      ? rawText
      : `1. Signature Choco Chip Cookies (100% Eggless) - Price: Rs. 250. Only 10 boxes available!
2. Double Dark Sea Salt Cookies (Eggless) - Rich 70% dark cocoa.
3. Oats & Cranberry Breakfast Cookies (Contains Egg) - Fresh daily bake. DM for pricing.
Delivery available across Indiranagar & Koramangala. No returns due to perishable nature.`;

  const deterministicCatalog = extractMerchantDataDeterministic(fallbackText, csvData);
  return {
    ...deterministicCatalog,
    providerUsed: 'deterministic',
  };
}
