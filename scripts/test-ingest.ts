import * as fs from 'fs';
import * as path from 'path';
import { extractMerchantData } from '../lib/ai/extractor';

async function runTest() {
  console.log('--- Testing Multimodal Structured Extraction Pipeline ---');

  const chatPath = path.resolve(__dirname, '../seed/sweet_crumbs_chat.txt');
  const csvPath = path.resolve(__dirname, '../seed/legacy_menu.csv');

  const rawText = fs.readFileSync(chatPath, 'utf8');
  const csvData = fs.readFileSync(csvPath, 'utf8');

  console.log('Invoking extractMerchantData with rawText and legacy CSV...');
  const result = await extractMerchantData(rawText, csvData);

  console.log('\n--- Extracted Catalog JSON ---');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n--- Verifying Extraction Requirements ---');

  // 1. Signature Choco Chip Cookies: price: 250, inventory: 10, eggless: true
  const chocoChip = result.products.find((p) =>
    p.name.toLowerCase().includes('signature choco chip')
  );
  if (!chocoChip) {
    throw new Error(
      'Verification failed: "Signature Choco Chip Cookies" not found in extracted products.'
    );
  }
  console.log('1. Signature Choco Chip Cookies extracted:', {
    price: chocoChip.price,
    inventory: chocoChip.inventory,
    isEggless: chocoChip.isEggless,
    sourceEvidence: chocoChip.sourceEvidence,
  });

  if (chocoChip.price !== 250) {
    throw new Error(`Expected price 250 for Choco Chip, got ${chocoChip.price}`);
  }
  if (chocoChip.inventory !== 10) {
    throw new Error(
      `Expected inventory 10 for Choco Chip, got ${chocoChip.inventory}`
    );
  }
  if (chocoChip.isEggless !== true) {
    throw new Error(
      `Expected isEggless true for Choco Chip, got ${chocoChip.isEggless}`
    );
  }

  // 2. Double Dark Sea Salt Cookies: price: null, inventory: null
  const seaSalt = result.products.find((p) =>
    p.name.toLowerCase().includes('double dark sea salt')
  );
  if (!seaSalt) {
    throw new Error(
      'Verification failed: "Double Dark Sea Salt Cookies" not found in extracted products.'
    );
  }
  console.log('2. Double Dark Sea Salt Cookies extracted:', {
    price: seaSalt.price,
    inventory: seaSalt.inventory,
    sourceEvidence: seaSalt.sourceEvidence,
  });

  if (seaSalt.price !== null) {
    throw new Error(
      `Expected price null for Double Dark Sea Salt, got ${seaSalt.price}`
    );
  }
  if (seaSalt.inventory !== null) {
    throw new Error(
      `Expected inventory null for Double Dark Sea Salt, got ${seaSalt.inventory}`
    );
  }

  // 3. Price conflict between WhatsApp (250) and CSV (200)
  const priceConflict = result.consistencyFlags.find(
    (f) =>
      f.field.toLowerCase().includes('price') &&
      f.detectedValues.includes('250') &&
      f.detectedValues.includes('200')
  );
  if (!priceConflict) {
    throw new Error(
      'Verification failed: Price conflict between WhatsApp (₹250) and CSV (₹200) not found in consistencyFlags.'
    );
  }
  console.log('3. Price Conflict Flag detected:', priceConflict);

  console.log('\n All Phase 3 extraction assertions passed successfully!');
}

runTest().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
