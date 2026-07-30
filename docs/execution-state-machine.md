# Execution state machine

```text
QUEUED
  -> EVALUATING_POLICY
       -> BLOCKED_BY_POLICY
       -> SKIPPED_PREVIOUS_EXECUTION_PENDING
       -> PENDING_USER_APPROVAL
       -> PENDING_SIGNATURE
       -> PENDING_CONFIRMATION
       -> PENDING_SETTLEMENT
       -> SUCCESS
       -> DENIED
       -> FAILED
       -> UNKNOWN
```

The provider request ID is persisted on the execution. Polling must always use
that same ID. A slow or temporarily unavailable request must never cause another
swap submission.
