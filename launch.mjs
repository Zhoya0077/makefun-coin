import { readFile, stat } from 'node:fs/promises';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CREATOR = '7ifFALpaMYDPrU8vz9B7T4RLaM2NKqgX16MbPewixaU4';
const WEBSITE = 'https://make.fun/bounty/makefun-coin-promo-01';
const API = 'https://pumpportal.fun/api';
const RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const base = new URL('./', import.meta.url);
const PRIORITY_SOL = 0.00001;
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0'));
  let result = '';
  while (n) { result = alphabet[Number(n % 58n)] + result; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; result = '1' + result; }
  return result;
}
export function privateKey(seed) {
  return createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
}
async function keypair(path, restricted = false) {
  if (restricted && ((await stat(path)).mode & 0o777) !== 0o600) throw new Error('Mint keypair permissions must be 0600');
  let values;
  try { values = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('Cannot read a keypair JSON file'); }
  if (!Array.isArray(values) || values.length !== 64 || !values.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) throw new Error('Keypair must contain exactly 64 byte values');
  const raw = Buffer.from(values);
  const key = privateKey(raw.subarray(0, 32));
  const pub = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
  if (!pub.equals(raw.subarray(32))) throw new Error('Keypair public bytes do not match seed');
  return { key, pub, address: base58(pub) };
}
async function metadata() {
  const text = await readFile(new URL('concept.md', base), 'utf8');
  const field = name => {
    const value = text.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1];
    if (!value) throw new Error(`Missing concept field: ${name}`);
    return value;
  };
  const description = text.match(/^Description:\r?\n([\s\S]+)$/m)?.[1].trim();
  if (!description?.includes(WEBSITE) || !description.includes('make.fun is')) throw new Error('Description must explain make.fun and include the bounty URL');
  const result = { name: field('Name'), symbol: field('Symbol'), description, website: field('Website') };
  if (result.website !== WEBSITE) throw new Error('Website must exactly equal the bounty URL');
  return result;
}
async function request(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).origin}${new URL(url).pathname}`);
  return response;
}
async function rpc(method, params) {
  const response = await request(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const data = await response.json();
  if (data.error) throw new Error(`RPC ${method} failed (code ${data.error.code})`);
  return data.result;
}
function shortvec(buffer, cursor) {
  let value = 0, shift = 0;
  for (let i = 0; i < 3; i++) {
    if (cursor.i >= buffer.length) throw new Error('Truncated transaction');
    const byte = buffer[cursor.i++]; value |= (byte & 127) << shift;
    if (!(byte & 128)) return value;
    shift += 7;
  }
  throw new Error('Invalid transaction length');
}
export function signTransaction(raw, creator, mint) {
  const cursor = { i: 0 };
  const count = shortvec(raw, cursor);
  if (count !== 2) throw new Error('Expected exactly creator and mint signatures');
  const signatureOffset = cursor.i;
  const messageOffset = signatureOffset + count * 64;
  const message = raw.subarray(messageOffset);
  let offset = 0;
  if (message[0] & 128) {
    if (message[0] !== 128) throw new Error('Unsupported transaction version');
    offset++;
  }
  if (message[offset] !== count) throw new Error('Invalid required signature count');
  const accountsCursor = { i: offset + 3 };
  const accounts = shortvec(message, accountsCursor);
  if (accounts < count || accountsCursor.i + accounts * 32 + 32 > message.length) throw new Error('Invalid account keys');
  if (!message.subarray(accountsCursor.i, accountsCursor.i + 32).equals(creator.pub)) throw new Error('Creator must be fee payer');
  const signed = Buffer.from(raw);
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const pub = message.subarray(accountsCursor.i + i * 32, accountsCursor.i + (i + 1) * 32);
    const signer = [creator, mint].find(k => k.pub.equals(pub));
    if (!signer || seen.has(signer.address)) throw new Error('Unexpected or duplicate signer');
    seen.add(signer.address);
    const signature = sign(null, message, signer.key);
    if (!verify(null, message, createPublicKey(signer.key), signature)) throw new Error('Signature verification failed');
    signature.copy(signed, signatureOffset + i * 64);
  }
  return signed;
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--go') || args.length > 1) throw new Error('Usage: node launch.mjs [--go]');
  const go = args.includes('--go');
  const meta = await metadata();
  const creator = await keypair('/home/hatch/workspace/makefun/makefun-keypair.json');
  if (creator.address !== CREATOR) throw new Error('Creator wallet does not match expected address');
  const mint = await keypair(new URL('mint-keypair.json', base), true);
  const png = await readFile(new URL('logo.png', base));
  if (png.length > 5 * 1024 * 1024 || png.length < 24 || !png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || png.readUInt32BE(16) !== 512 || png.readUInt32BE(20) !== 512) throw new Error('Logo must be a 512x512 PNG of at most 5 MiB');
  const balance = await rpc('getBalance', [creator.address, { commitment: 'confirmed' }]);
  // Planning estimate only: typical mint, curve, token account and metadata rents.
  // Account sizes and protocol charges may change; reserve includes this uncertainty.
  const sizes = [82, 151, 165, 679];
  const rents = await Promise.all(sizes.map(size => rpc('getMinimumBalanceForRentExemption', [size])));
  const rentLamports = rents.reduce((sum, v) => sum + v, 0);
  const estimatedLamports = rentLamports + 10000 + Math.round(PRIORITY_SOL * 1e9) + 10000000;
  console.log(JSON.stringify({
    mode: go ? 'LIVE (--go)' : 'DRY RUN: no upload, transaction construction, signing or broadcast',
    metadata: meta, mint: mint.address, creator: creator.address,
    rpc: new URL(RPC).origin, balanceSOL: balance.value / 1e9, balanceSlot: balance.context.slot,
    estimatedTotalCreationCostSOL: estimatedLamports / 1e9,
    estimate: { rentAccountSizes: sizes, rentSOL: rentLamports / 1e9, twoSignatureBaseFeeSOL: 0.00001, priorityFeeSOL: PRIORITY_SOL, contingencySOL: 0.01, initialBuySOL: 0, note: 'Planning budget, not an exact transaction quote; protocol costs and account sizes may change.' }
  }, null, 2));
  if (!go) return;
  if (balance.value < estimatedLamports) throw new Error('Fund creator wallet to at least the planning budget before launch');
  if ((await rpc('getAccountInfo', [mint.address, { encoding: 'base64', commitment: 'confirmed' }])).value) throw new Error('Mint account already exists; refusing a repeat launch');
  const form = new FormData();
  for (const [key, value] of Object.entries(meta)) form.append(key, value);
  form.append('showName', 'true');
  form.append('file', new Blob([png], { type: 'image/png' }), 'logo.png');
  const upload = await (await request(`${API}/ipfs-upload`, { method: 'POST', body: form })).json();
  if (typeof upload.metadataUri !== 'string' || !/^(https:\/\/|ipfs:\/\/)/.test(upload.metadataUri)) throw new Error('Upload did not return a valid metadataUri');
  const transaction = await request(`${API}/trade-local`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey: creator.address, action: 'create', tokenMetadata: { name: meta.name, symbol: meta.symbol, uri: upload.metadataUri }, mint: mint.address, denominatedInSol: 'true', amount: 0, slippage: 10, priorityFee: PRIORITY_SOL, pool: 'pump' })
  });
  const signed = signTransaction(Buffer.from(await transaction.arrayBuffer()), creator, mint);
  const signature = await rpc('sendTransaction', [signed.toString('base64'), { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 }]);
  console.log(`Mint: ${mint.address}\nTransaction signature: ${signature}\nBroadcast accepted; awaiting confirmation.`);
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = (await rpc('getSignatureStatuses', [[signature], { searchTransactionHistory: true }])).value[0];
    if (status?.err) throw new Error('Transaction failed on chain; inspect the printed signature');
    if (['confirmed', 'finalized'].includes(status?.confirmationStatus)) {
      console.log(`Transaction ${status.confirmationStatus}: ${signature}`); return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Confirmation timed out; inspect the printed signature before retrying');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`Launch stopped: ${error.message}`); process.exitCode = 1; });
}
