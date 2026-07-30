# Paybox integration status and gaps

Verified without authentication:

- `https://api.paybox.sh/mcp` is live and requires an OAuth 2.1 bearer token.
- Protected-resource discovery points to `https://api.paybox.sh`.
- Authorization-code, refresh-token, PKCE S256, dynamic client registration,
  `mcp`, and `offline_access` are advertised.

Verified through the authenticated MoonPay/Paybox connector:

- A granted Solana wallet and live portfolio balances are available.
- Exact schemas for credential listing, portfolio reads, account changes,
  swaps, signing, transfers, and request polling are exposed.
- Coinbase's published Solana cbBTC mint matches the fixed application mint.

Implemented for the hosted app:

- Dynamic public client registration.
- Authorization code with PKCE S256 and state validation.
- Encrypted access/refresh-token storage and refresh.
- Authenticated MCP initialization, tool discovery, credential listing, and
  portfolio reads.

Still unverified in the hosted OAuth client:

- The final user-consent redirect and callback.
- Offline refresh-token lifetime and autonomous signing behavior.
- Whether provider-level idempotency is supported by `request_swap`.
- Whether webhooks are available for grants, revocations, or request updates.

Real recurring execution must remain disabled until provider idempotency and
offline authorization are confirmed.
