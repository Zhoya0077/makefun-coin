import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const botDir = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const launchPath = join(botDir, 'LAUNCH.json');
const outputPath = join(outputDir, 'LAUNCH.json');

const placeholderMint = 'REPLACE_WITH_YOUR_COINS_MINT';
const placeholderSignature = 'REPLACE_WITH_THE_CREATE_TRANSACTIONS_SIGNATURE';

function fail(message: string): never {
  console.error(`Invalid LAUNCH.json: ${message}`);
  process.exit(1);
}

let launchText: string;
try {
  launchText = readFileSync(launchPath, 'utf8');
} catch (error) {
  fail(`could not be read from ${botDir}: ${(error as Error).message}`);
}

let launch: unknown;
try {
  launch = JSON.parse(launchText);
} catch (error) {
  fail(`is not valid JSON: ${(error as Error).message}`);
}

if (launch === null || typeof launch !== 'object' || Array.isArray(launch)) {
  fail('must be a JSON object');
}

const record = launch as Record<string, unknown>;
const mint = record.mint;
const signature = record.create_signature;

if (typeof mint !== 'string' || mint.trim() === '') {
  fail('mint must be a non-empty string');
}
if (mint === placeholderMint) {
  fail('mint still has the starter placeholder value');
}
if (typeof signature !== 'string' || signature.trim() === '') {
  fail('create_signature must be a non-empty string');
}
if (signature === placeholderSignature) {
  fail('create_signature still has the starter placeholder value');
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(launchPath, outputPath);
console.log(`Copied LAUNCH.json for mint ${mint}`);
