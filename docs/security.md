# Security model

- The browser cannot edit the token mints, amount, chain, direction, or
  slippage ceiling.
- Environment validation requires Circle's canonical Solana USDC mint.
- Real execution is guarded by separate one-off and recurring flags.
- Financial requests reserve spending until their outcome is known.
- Unknown outcomes retain their reservation.
- Private keys and seed phrases are never accepted or stored.
- Bearer tokens, authorization headers, and raw secrets must be redacted from
  provider responses and logs.
- Paybox OAuth access and refresh tokens are encrypted with AES-256-GCM before
  they are stored in Prisma Postgres.

The application is single-owner software. The current hosted prototype is
public, so real financial execution must remain disabled until a proper
multi-user identity and authorization model is added.
