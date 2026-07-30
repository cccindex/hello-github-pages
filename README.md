# Five Minute Bitcoin

A narrow hosted prototype that swaps exactly 1 USDC into cbBTC on Solana every
five minutes through a Paybox provider.

Production uses `PAYBOX_MODE=real` for a real Paybox OAuth 2.1 wallet
connection and live portfolio reads. Real financial execution remains disabled,
and the provider stops before creating a swap until the remaining real-money
checks are complete.

## Hosted deployment

The production app runs as a full Next.js deployment on Vercel:

- Next.js pages and API route handlers run on Vercel.
- Prisma Postgres stores application state and the execution audit log.
- A secured Vercel Cron Job checks due automations every five minutes.
- `CRON_SECRET` authenticates scheduler invocations.
- Paybox access and refresh tokens are encrypted with AES-256-GCM before storage.

The hosted app does not require a developer computer, local PostgreSQL, a
Cloudflare tunnel, or the local worker to remain online.

Deployments must keep `ALLOW_REAL_FINANCIAL_EXECUTION=false` and
`ALLOW_REAL_RECURRING_EXECUTION=false` until the real-money checklist has been
completed.

## Run locally

Requirements:

- Node.js 24+
- Docker Desktop
- pnpm

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:push
pnpm dev
```

Open http://localhost:3000.

For local-only scheduler testing, run:

```bash
pnpm worker
```

This worker is only needed for local development. Production scheduling is
handled by Vercel Cron.

## Mock demo

1. Open **Connect** and connect Mock Paybox.
2. Open **Wallet setup** and select Personal Solana Wallet.
3. Run the $1 test purchase.
4. Approve the pending purchase from the dashboard.
5. Type `ACTIVATE`.
6. Use **Run one now** for the shared manual execution path.
7. Leave `pnpm worker` running locally, or use the hosted Vercel Cron Job, to
   process actual five-minute due times.
8. Inspect every policy check and state transition in **Activity**.

Reset all demo data from **Settings**.

## Tests

```bash
pnpm test
pnpm build
```

## Safety

- Source: canonical Circle USDC on Solana
- Destination: exact cbBTC Solana mint
- Amount: exactly 1 USDC
- Maximum: 12 purchases per rolling hour
- Maximum: $12 per rolling 24 hours
- Maximum: $25 lifetime
- Expiration: 24 hours after activation
- Only one financially in-flight request at a time
- Real one-off and recurring execution require separate opt-in flags

See [docs/security.md](docs/security.md) and
[docs/real-money-checklist.md](docs/real-money-checklist.md) before changing
either real-execution flag.
