import { GoogleGenAI } from '@google/genai';

export const GEMINI_CASCADE = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;

export interface CascadeRequestOptions {
  userPrompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  imageBase64?: string;
  imageMimeType?: string;
  temperature?: number;
}

export interface CascadeResponse {
  text: string;
  providerUsed: 'groq' | 'gemini';
  modelUsed: string;
}

export function cleanJson(raw: string): string {
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

/**
 * Execute a single Gemini model call with an explicit timeout.
 */
async function callGeminiWithTimeout(
  ai: GoogleGenAI,
  model: string,
  contents: any,
  config: any,
  timeoutMs: number
): Promise<string> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Gemini model "${model}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents,
        config,
      }),
      timeoutPromise,
    ]);

    if (!response.text) {
      throw new Error(`Gemini model "${model}" returned empty response text.`);
    }
    return response.text;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Attempt Gemini cascade through configured models.
 */
async function tryGeminiCascade(
  options: CascadeRequestOptions,
  accumulatedErrors: string[],
  timeoutMs: number = 15000
): Promise<CascadeResponse | null> {
  const geminiApiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    ''
  ).trim();

  if (!geminiApiKey) {
    accumulatedErrors.push('[Gemini] GEMINI_API_KEY is not set or empty.');
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const {
    userPrompt,
    systemPrompt,
    jsonMode = false,
    imageBase64,
    imageMimeType = 'image/jpeg',
    temperature,
  } = options;

  let contents: any;
  if (imageBase64) {
    let cleanBase64 = imageBase64;
    let detectedMime = imageMimeType;
    if (cleanBase64.startsWith('data:')) {
      const split = cleanBase64.split(';base64,');
      cleanBase64 = split[1] || split[0];
      const mimeMatch = split[0].match(/data:(.*?)$/);
      if (mimeMatch) {
        detectedMime = mimeMatch[1];
      }
    }

    contents = [
      {
        inlineData: {
          data: cleanBase64,
          mimeType: detectedMime,
        },
      },
      userPrompt,
    ];
  } else {
    contents = userPrompt;
  }

  const config: Record<string, any> = {};
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }
  if (jsonMode) {
    config.responseMimeType = 'application/json';
  }
  if (temperature !== undefined) {
    config.temperature = temperature;
  }

  for (const model of GEMINI_CASCADE) {
    try {
      const text = await callGeminiWithTimeout(ai, model, contents, config, timeoutMs);
      return {
        text,
        providerUsed: 'gemini',
        modelUsed: model,
      };
    } catch (geminiModelErr: unknown) {
      const modelMsg =
        geminiModelErr instanceof Error
          ? geminiModelErr.message
          : String(geminiModelErr);
      accumulatedErrors.push(`[Gemini ${model}] ${modelMsg}`);
      console.warn(
        `[AI Cascade] Gemini model "${model}" failed (${modelMsg}). Trying next in cascade...`
      );
    }
  }

  return null;
}

/**
 * Attempt Groq Cloud execution with vision or text models.
 */
async function tryGroq(
  options: CascadeRequestOptions,
  accumulatedErrors: string[]
): Promise<CascadeResponse | null> {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (!groqApiKey) {
    accumulatedErrors.push('[Groq] GROQ_API_KEY is not set or empty.');
    return null;
  }

  const { Groq } = await import('groq-sdk');
  const groq = new Groq({ apiKey: groqApiKey });
  const {
    userPrompt,
    systemPrompt,
    jsonMode = false,
    imageBase64,
    imageMimeType = 'image/jpeg',
    temperature,
  } = options;

  let completion;
  let selectedModel = '';

  if (imageBase64) {
    const formattedUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${imageMimeType};base64,${imageBase64}`;

    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: formattedUrl } },
      ],
    });

    try {
      selectedModel = 'llama-3.2-11b-vision-preview';
      completion = await groq.chat.completions.create({
        model: selectedModel,
        messages: messages as any,
        response_format: jsonMode ? { type: 'json_object' } : undefined,
        temperature,
      });
    } catch (visErr: unknown) {
      const visMsg = visErr instanceof Error ? visErr.message : String(visErr);
      accumulatedErrors.push(`[Groq ${selectedModel}] ${visMsg}`);

      // Fallback to llama-3.2-90b-vision-preview
      try {
        selectedModel = 'llama-3.2-90b-vision-preview';
        completion = await groq.chat.completions.create({
          model: selectedModel,
          messages: messages as any,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
          temperature,
        });
      } catch (vis90Err: unknown) {
        const vis90Msg = vis90Err instanceof Error ? vis90Err.message : String(vis90Err);
        accumulatedErrors.push(`[Groq ${selectedModel}] ${vis90Msg}`);
        // Fallback to active high-capacity Groq model
        selectedModel = 'openai/gpt-oss-120b';
        completion = await groq.chat.completions.create({
          model: selectedModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ] as any,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
          temperature,
        });
      }
    }
  } else {
    // Pure text / Intent / Tool Calling: Groq Primary
    selectedModel = 'llama-3.3-70b-versatile';
    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    try {
      completion = await groq.chat.completions.create({
        model: selectedModel,
        messages: messages as any,
        response_format: jsonMode ? { type: 'json_object' } : undefined,
        temperature,
      });
    } catch (textErr: unknown) {
      const textMsg = textErr instanceof Error ? textErr.message : String(textErr);
      accumulatedErrors.push(`[Groq ${selectedModel}] ${textMsg}`);

      // Try openai/gpt-oss-120b on Groq if llama-3.3-70b is unavailable
      selectedModel = 'openai/gpt-oss-120b';
      completion = await groq.chat.completions.create({
        model: selectedModel,
        messages: messages as any,
        response_format: jsonMode ? { type: 'json_object' } : undefined,
        temperature,
      });
    }
  }

  const content = completion?.choices[0]?.message?.content;
  if (content) {
    return {
      text: content,
      providerUsed: 'groq',
      modelUsed: selectedModel,
    };
  }

  throw new Error('Groq returned empty response content.');
}

/**
 * Smart Routing AI Provider Cascade:
 * - Vision / Image Uploads (imageBase64 present):
 *   1. Primary: Gemini Multimodal Vision Cascade (gemini-3.6-flash -> gemini-3.5-flash -> ...) with >=12s timeout
 *   2. Secondary Fallback: Groq Vision (llama-3.2-11b-vision-preview -> llama-3.2-90b-vision-preview)
 * - Pure Text / Intent / Buyer Queries:
 *   1. Primary: Groq Cloud (llama-3.3-70b-versatile -> openai/gpt-oss-120b) to conserve Gemini quota
 *   2. Secondary Fallback: Gemini Cascade
 * Throws explicit error with accumulated failure reasons if all providers fail.
 */
export async function executeAICascade(
  options: CascadeRequestOptions
): Promise<CascadeResponse> {
  const accumulatedErrors: string[] = [];

  if (options.imageBase64) {
    // =========================================================================
    // 1. VISION ROUTING: Gemini Primary (Superior OCR) -> Groq Vision Fallback
    // =========================================================================
    // OCR requires 8-10s for dense physical menus; enforce minimum 12000ms timeout
    const visionTimeoutMs = 15000;
    try {
      const geminiRes = await tryGeminiCascade(options, accumulatedErrors, visionTimeoutMs);
      if (geminiRes) {
        return geminiRes;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      accumulatedErrors.push(`[Gemini Vision Primary Error] ${msg}`);
    }

    console.warn(
      '[AI Cascade] Gemini Vision unavailable or timed out (>12s). Falling back to Groq Vision...'
    );

    try {
      const groqRes = await tryGroq(options, accumulatedErrors);
      if (groqRes) {
        return groqRes;
      }
    } catch (groqErr: unknown) {
      const errMsg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      accumulatedErrors.push(`[Groq Vision Fallback Error] ${errMsg}`);
    }
  } else {
    // =========================================================================
    // 2. TEXT ROUTING: Groq Primary (Free RPD Throughput) -> Gemini Cascade Fallback
    // =========================================================================
    try {
      const groqRes = await tryGroq(options, accumulatedErrors);
      if (groqRes) {
        return groqRes;
      }
    } catch (groqErr: unknown) {
      const errMsg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      accumulatedErrors.push(`[Groq Primary Error] ${errMsg}`);
      console.warn(
        `[AI Cascade] Groq exhausted or rate-limited (${errMsg}). Falling back to Gemini cascade...`
      );
    }

    try {
      const geminiRes = await tryGeminiCascade(options, accumulatedErrors, 15000);
      if (geminiRes) {
        return geminiRes;
      }
    } catch (geminiErr: unknown) {
      const errMsg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      accumulatedErrors.push(`[Gemini Fallback Error] ${errMsg}`);
    }
  }

  // =========================================================================
  // 3. ERROR REPORTING
  // =========================================================================
  const fullErrorMessage = `[AI Cascade] All primary (Groq) and secondary (Gemini) models failed.\nAccumulated Errors:\n${accumulatedErrors
    .map((e, idx) => `  ${idx + 1}. ${e}`)
    .join('\n')}`;

  throw new Error(fullErrorMessage);
}

// Alias for convenience
export const callAICascade = executeAICascade;

