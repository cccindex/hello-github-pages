# Five Minute Bitcoin

A narrow local prototype that swaps exactly 1 USDC into cbBTC on Solana every
five minutes through a Paybox provider.

The current working mode is `PAYBOX_MODE=mock`. Real financial execution is
disabled and the real provider stops before creating a swap until authenticated
Paybox MCP tools have been discovered and normalized.

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

The GitHub Pages frontend can also be opened from the same computer. Because
browsers block an HTTPS Pages site from reading a plain HTTP localhost response,
start a temporary HTTPS tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Paste the resulting `https://…trycloudflare.com` address into the Pages
frontend. The address is stored only in that browser. The local Next.js server,
PostgreSQL, worker, and tunnel must remain running.

Quick tunnels are for mock testing only. Do not enable real financial execution
through a public quick-tunnel URL.

In another terminal, start the local scheduler:

```bash
pnpm worker
```

Your computer must remain awake and both processes must remain running for
scheduled executions.

## Mock demo

1. Open **Connect** and connect Mock Paybox.
2. Open **Wallet setup** and select Personal Solana Wallet.
3. Run the $1 test purchase.
4. Approve the pending purchase from the dashboard.
5. Type `ACTIVATE`.
6. Use **Run one now** for the shared manual execution path.
7. Leave `pnpm worker` running to process actual five-minute due times.
8. Inspect every policy check and state transition in **Activity**.

Reset all local demo data from **Settings**.

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
