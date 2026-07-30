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
- Paybox tokens must be encrypted before real mode stores them locally.

The local prototype is single-owner software. Do not expose its port to the
public internet.
