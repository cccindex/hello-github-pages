# Real-money checklist

Do not enable real execution until all items pass:

- [ ] Authenticated Paybox `tools/list` captured and reviewed.
- [ ] Credential ownership and Solana support verified.
- [ ] Exact live `request_swap` schema mapped.
- [ ] Paybox provider-level idempotency confirmed.
- [ ] Crash recovery between submission and request-ID persistence tested.
- [ ] `get_request` terminal and unknown states mapped.
- [ ] Offline refresh and signing behavior confirmed.
- [ ] Token encryption key stored outside the repository.
- [ ] One approval-required $1 test purchase succeeds.
- [ ] On-chain balance change is independently observed.
- [ ] Pause and revoke block the next request.
- [ ] Duplicate scheduler delivery cannot purchase twice.
- [ ] `ALLOW_REAL_FINANCIAL_EXECUTION` enabled intentionally.
- [ ] `ALLOW_REAL_RECURRING_EXECUTION` remains false until a separate review.
