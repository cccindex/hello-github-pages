# Architecture

The browser communicates with same-origin Next.js route handlers on Vercel.
Prisma Postgres is the source of truth for connection state, automation state, executions,
reservations, and transitions.

Both manual and scheduled purchases call the same `createExecution` coordinator.
The coordinator evaluates policy before creating exactly one provider request.
The mock provider rejects duplicate provider idempotency keys.

Vercel Cron invokes the secured `/api/cron` route every five minutes. The route
polls PostgreSQL for due active automations, so production scheduling is
independent of a developer computer. The local worker remains available for
offline development.

Provider implementations sit behind `PayboxProvider`. Mock mode is complete.
Real mode must stop before submission until OAuth and authenticated live MCP
tool schemas have been validated.
