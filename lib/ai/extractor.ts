import { GoogleGenAI } from '@google/genai';
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

function cleanJson(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

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

export async function extractMerchantData(
  rawText: string,
  csvData?: string
): Promise<ExtractedCatalog> {
  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ''
  ).trim();

  const userPrompt = `RAW MERCHANT INPUT:
"""
${rawText}
"""

${
  csvData
    ? `LEGACY CSV CATALOG:
"""
${csvData}
"""`
    : ''
}

Extract the structured catalog following the adversarial instructions and strict null rules. Output strictly JSON.`;

  // 1. Attempt Gemini 2.5 Flash if Gemini/AI key is provided
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        const parsed = JSON.parse(cleanJson(response.text));
        return ExtractedCatalogSchema.parse(parsed);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(
        'Gemini extraction failed, falling back to alternative pipeline:',
        errorMessage
      );
    }
  }

  // 2. Attempt OpenAI if OPENAI_API_KEY is detected
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(cleanJson(content));
        return ExtractedCatalogSchema.parse(parsed);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(
        'OpenAI extraction failed, falling back to deterministic extraction:',
        errorMessage
      );
    }
  }

  // 3. Fallback deterministic adversarial extractor
  return extractMerchantDataDeterministic(rawText, csvData);
}
