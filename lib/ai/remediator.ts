import { executeAICascade, cleanJson } from './cascade';

export interface RemediationIssueInput {
  id?: string;
  merchantId?: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  remediationSuggestion?: string | null;
}

export interface RemediationAdvice {
  explanation: string;
  suggestedAction: string;
  draftContent?: string;
}

export function generateDeterministicAdvice(
  issue: RemediationIssueInput
): RemediationAdvice {
  const cat = (issue.category || '').toUpperCase();
  const title = (issue.title || '').toLowerCase();
  const desc = (issue.description || '').toLowerCase();

  // 1. Price Conflict / Consistency
  if (cat === 'CONSISTENCY' || title.includes('conflict') || desc.includes('conflict') || desc.includes('discrepancy')) {
    // Extract values if available (e.g. 250, 200)
    let valuesNote = 'WhatsApp message vs legacy catalog CSV';
    const valMatch = issue.description.match(/(\d+(?:\.\d+)?)\s*(?:and|,|vs)\s*(\d+(?:\.\d+)?)/i);
    if (valMatch) {
      valuesNote = `WhatsApp message states ₹${valMatch[1]} while legacy catalog lists ₹${valMatch[2]}`;
    }

    return {
      explanation: `Autonomous AI buyers halt transactions when catalog sources disagree (${valuesNote}). An AI agent will reject checkout carts immediately due to unverified pricing risk.`,
      suggestedAction: 'Select the authoritative ground truth price to override legacy catalogs and unblock automated checkout.',
      draftContent: valMatch ? valMatch[1] : '250',
    };
  }

  // 2. Missing Price
  if (cat === 'PRICE' || title.includes('missing verified price') || desc.includes('price')) {
    return {
      explanation: "AI purchasing agents cannot propose or execute transactions on items with 'DM for pricing' or null price tags. Transactions without explicit unit pricing are strictly blocked by financial invariants.",
      suggestedAction: 'Set an explicit fixed unit price so autonomous agents can calculate cart totals and execute orders.',
      draftContent: '220',
    };
  }

  // 3. Unverified Inventory
  if (cat === 'INVENTORY' || title.includes('inventory') || desc.includes('inventory')) {
    return {
      explanation: 'AI shopping assistants will not reserve orders without confirmed stock quantities to prevent overselling and post-payment cancellation penalties.',
      suggestedAction: 'Confirm available batch quantity or allocate safe stock buffer for this product.',
      draftContent: '15',
    };
  }

  // 4. Missing or Unverified Policies
  if (cat === 'POLICY' || title.includes('policy') || desc.includes('policy') || desc.includes('refund') || desc.includes('perish')) {
    return {
      explanation: 'Fintech payment rails and agentic buyers mandate explicit return and cancellation terms before authorization to avoid disputes on perishable goods.',
      suggestedAction: 'Review and approve the standardized perishable goods refund disclaimer.',
      draftContent:
        'Due to the fresh, perishable nature of our artisan baked goods, all orders are final once dispatched. In the unlikely event of transit damage or incorrect items, please notify us within 2 hours of delivery with photo evidence for an immediate replacement or UPI refund.',
    };
  }

  // General fallback
  return {
    explanation:
      'Autonomous transaction systems require strict catalog completeness. Unresolved discrepancies block customer agents from completing transactions.',
    suggestedAction:
      issue.remediationSuggestion || 'Verify this data point with the merchant.',
    draftContent: undefined,
  };
}

export async function generateRemediationAdvice(
  issue: RemediationIssueInput
): Promise<RemediationAdvice> {
  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ''
  ).trim();

  const prompt = `You are a fintech AI agent readiness advisor.
Analyze the following merchant readiness issue and generate actionable remediation advice:
Title: ${issue.title}
Category: ${issue.category}
Severity: ${issue.severity}
Description: ${issue.description}

Provide:
1. "explanation": Explain clearly in 1-2 sentences why this issue matters for autonomous AI buyers and fintech settlement.
2. "suggestedAction": A clear, concise 1-sentence prompt for the merchant to resolve it.
3. "draftContent": If applicable, provide a ready-to-use draft (e.g. policy text, authoritative price, or inventory count).

Return strictly JSON with keys: "explanation", "suggestedAction", "draftContent".`;

  // 1. Execute AI Cascade (Groq Primary -> Gemini Cascade Secondary Fallback)
  try {
    const cascadeRes = await executeAICascade({
      userPrompt: prompt,
      jsonMode: true,
    });

    if (cascadeRes.text) {
      const parsed = JSON.parse(cleanJson(cascadeRes.text));
      if (parsed.explanation && parsed.suggestedAction) {
        return {
          explanation: parsed.explanation,
          suggestedAction: parsed.suggestedAction,
          draftContent: parsed.draftContent || undefined,
        };
      }
    }
  } catch {
    // Gracefully fall through to deterministic advice engine
  }

  // 3. Fallback deterministic advice engine
  return generateDeterministicAdvice(issue);
}
