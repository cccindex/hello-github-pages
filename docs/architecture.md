# Architecture

The browser communicates only with local Next.js route handlers. PostgreSQL is
the source of truth for connection state, automation state, executions,
reservations, and transitions.

Both manual and scheduled purchases call the same `createExecution` coordinator.
The coordinator evaluates policy before creating exactly one provider request.
The mock provider rejects duplicate provider idempotency keys.

The local worker polls PostgreSQL for due active automations. It runs only while
the computer is awake and the worker process is active.

Provider implementations sit behind `PayboxProvider`. Mock mode is complete.
Real mode must stop before submission until OAuth and authenticated live MCP
tool schemas have been validated.
