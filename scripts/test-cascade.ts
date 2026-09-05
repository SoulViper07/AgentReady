import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { executeAICascade, GEMINI_CASCADE } from '../lib/ai/cascade';

async function main() {
  console.log('=== Testing AI Provider Cascade (Groq Primary -> Gemini Cascade) ===\n');
  console.log(`Gemini Cascade Models (${GEMINI_CASCADE.length}):`, GEMINI_CASCADE.join(' -> '));

  console.log('\n1. Testing Text/Intent Prompt via AI Cascade...');
  const res = await executeAICascade({
    userPrompt: 'Output a valid JSON object with key "status" set to "online" and "message" set to "hello".',
    jsonMode: true,
  });

  console.log(`   Provider Used: ${res.providerUsed}`);
  console.log(`   Model Used:    ${res.modelUsed}`);
  console.log(`   Response Text: ${res.text.trim().slice(0, 100)}`);

  const parsed = JSON.parse(res.text);
  if (!parsed || parsed.status !== 'online') {
    throw new Error('Expected parsed JSON with status: online');
  }

  console.log('\n2. Testing Error Accumulation when invalid keys are passed...');
  const origGroq = process.env.GROQ_API_KEY;
  const origGemini = process.env.GEMINI_API_KEY;
  const origAi = process.env.AI_API_KEY;
  try {
    process.env.GROQ_API_KEY = 'invalid_groq_key_test';
    process.env.GEMINI_API_KEY = 'invalid_gemini_key_test';
    delete process.env.AI_API_KEY;

    let threw = false;
    try {
      await executeAICascade({ userPrompt: 'test prompt' });
    } catch (err: unknown) {
      threw = true;
      const msg = err instanceof Error ? err.message : String(err);
      console.log('   Expected failure caught with message snippet:');
      console.log(`   ${msg.split('\n')[0]}`);
      if (!msg.includes('[AI Cascade] All primary (Groq) and secondary (Gemini) models failed')) {
        throw new Error('Expected explicit error with accumulated failure reasons');
      }
    }
    if (!threw) {
      throw new Error('Expected executeAICascade to throw error when all providers fail');
    }
  } finally {
    process.env.GROQ_API_KEY = origGroq;
    process.env.GEMINI_API_KEY = origGemini;
    if (origAi) process.env.AI_API_KEY = origAi;
  }

  console.log('\n🎉 ALL CASCADE TESTS PASSED SUCCESSFULLY!');
}

main().catch((e) => {
  console.error('Cascade Test Failed:', e);
  process.exit(1);
});
