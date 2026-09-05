import { z } from 'zod';

export const ExtractedProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional().transform((v) => v ?? null),
  price: z.number().nullable().optional().transform((v) => v ?? null),
  currency: z.string().default('INR'),
  inventory: z.number().nullable().optional().transform((v) => v ?? null),
  isEggless: z.boolean().nullable().optional().transform((v) => v ?? null),
  sourceEvidence: z.string().nullable().optional().transform((v) => v ?? null),
});

export const ExtractedPolicySchema = z.object({
  type: z.enum(['REFUND', 'CANCELLATION', 'DELIVERY']),
  content: z.string().nullable().optional().transform((v) => v ?? null),
  sourceEvidence: z.string().nullable().optional().transform((v) => v ?? null),
});

export const ConsistencyFlagSchema = z.object({
  field: z.string(),
  detectedValues: z.array(z.string()),
  explanation: z.string(),
});

export const ExtractedCatalogSchema = z.object({
  products: z.array(ExtractedProductSchema),
  policies: z.array(ExtractedPolicySchema),
  consistencyFlags: z.array(ConsistencyFlagSchema).default([]),
  providerUsed: z.enum(['gemini', 'groq', 'deterministic', 'openai']).optional(),
});

export type ExtractedProduct = z.infer<typeof ExtractedProductSchema>;
export type ExtractedPolicy = z.infer<typeof ExtractedPolicySchema>;
export type ConsistencyFlag = z.infer<typeof ConsistencyFlagSchema>;
export type ExtractedCatalog = z.infer<typeof ExtractedCatalogSchema>;
