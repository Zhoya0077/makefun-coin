# Build In Public (BUIDL)

Prepared entry for make.fun's makefun-coin-promo-01 bounty:
https://make.fun/bounty/makefun-coin-promo-01

Name: Build In Public
Symbol: BUIDL
Website: https://make.fun/bounty/makefun-coin-promo-01

Exact description from concept.md:

BUIDL is an agent-made promotional coin and an entry in the make.fun coin promo bounty. It is not an official make.fun token or investment in make.fun. make.fun is a site where people and their AI agents build programs, enter paid bounty competitions, and are scored and ranked in the open. This coin is the build signal: agents turn ideas into working software, compete in public, and ship the result. Read the bounty and judge the build: https://make.fun/bounty/makefun-coin-promo-01

The logo depicts a building agent inside a gold coin with code brackets and a bounty flag. logo.svg is the source; logo.png is its Chromium-rendered 512×512 PNG (35,982 bytes, below 5 MiB).

## Files and keys

- concept.md: authoritative launch metadata, parsed at execution time.
- logo.svg and logo.png: source logo and upload image.
- mint-keypair.json: freshly generated Solana 64-byte seed-plus-public-key JSON array, permissions 0600. This is a secret local file: keep it private and out of commits or submissions.
- launch.mjs: dependency-free Node launch script using fetch and node:crypto Ed25519 signing.

Mint public address: 4aUnQf9aYvucEVusD57eg6oogucvkD2ryKb5ZxasFa9j

Creator public address: 7ifFALpaMYDPrU8vz9B7T4RLaM2NKqgX16MbPewixaU4

The creator keypair stays at /home/hatch/workspace/makefun/makefun-keypair.json. Neither secret is logged or sent to PumpPortal. No coin has been launched or bounty entry submitted during preparation.

## Dry run

Requires Node 22 or newer; no npm packages or installation are needed. From this directory:

    node launch.mjs

Without --go, the script validates the metadata, logo, keypairs, creator address, and mint permissions, then calls only the read-only Solana RPC methods getBalance and getMinimumBalanceForRentExemption. It does not upload, construct a transaction, sign, or broadcast. It prints the exact metadata, mint public address, current creator balance and a planning estimate.

The preparation dry run returned a creator balance of 0 SOL at slot 469764934 and a planning total of 0.01809212 SOL. The estimate includes 0.00807212 SOL of rent for assumed account sizes (82, 151, 165 and 679 bytes), a 0.00001 SOL two-signature base fee, a 0.00001 SOL requested priority fee and a 0.01 SOL contingency. Initial buy is zero. This is a budget estimate, not a transaction quote: account layouts, protocol charges and network fees may change. The dry run intentionally avoids uploading metadata or requesting a create transaction, so it cannot quote their exact costs.

By default the public mainnet RPC is https://api.mainnet-beta.solana.com. Override it with SOLANA_RPC_URL if needed. Balances and rent estimates are retrieved anew on each execution.

## Later launch after funding

Fund the creator public address with enough mainnet SOL to cover the current planning estimate, then rerun the dry run. The following command is for a separately authorized future launch and was NOT executed during preparation:

    node launch.mjs --go

With --go, the script checks funding and that the mint account does not already exist, uploads logo.png and the exact concept metadata as multipart form data to https://pumpportal.fun/api/ipfs-upload, then requests a transaction from https://pumpportal.fun/api/trade-local with action create, mint equal to the mint public address, denominatedInSol "true", amount 0, pool pump, and priorityFee 0.00001. There is no initial buy.

It accepts legacy or v0 transaction message envelopes, verifies that the only two signers are the creator and mint and that the creator is the fee payer, signs the serialized message locally using the raw keypair seeds, and sends the base64 transaction to the public RPC with preflight enabled. It prints the mint address and RPC transaction signature and polls for confirmation. If confirmation times out, inspect the signature before retrying.

PumpPortal's current creation documentation (https://pumpportal.fun/creation/) illustrates Pinata metadata uploads rather than the requested /api/ipfs-upload endpoint. This implementation retains the exact requested endpoint; its upload response and the live create/broadcast path have not been exercised. An unavailable endpoint, rejected zero-buy transaction, or changed API schema will stop the launch with an error. Do not treat the successful read-only dry run as verification of these live services.
