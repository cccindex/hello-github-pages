# Paybox integration status and gaps

Verified without authentication:

- `https://api.paybox.sh/mcp` is live and requires an OAuth 2.1 bearer token.
- Protected-resource discovery points to `https://api.paybox.sh`.
- Authorization-code, refresh-token, PKCE S256, dynamic client registration,
  `mcp`, and `offline_access` are advertised.

Still unverified:

- Whether third-party client registration succeeds for this local redirect URI.
- The Paybox user-consent and account-selection experience.
- The authenticated `tools/list` response.
- The existence and exact schemas of credential, portfolio, grant, swap,
  request-polling, and revocation tools.
- Stable mapping between the local owner and a Paybox user.
- Offline refresh-token lifetime and autonomous signing behavior.
- Whether provider-level idempotency is supported by `request_swap`.
- Whether webhooks are available for grants, revocations, or request updates.

Real recurring execution must remain disabled until provider idempotency and
offline authorization are confirmed.
