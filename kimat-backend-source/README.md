# Kimat backend source

This archive contains the Kimat Express API server plus the shared generated validation contracts and database package it imports.

## Included

- `artifacts/api-server` — Express server source, routes, logger, and build configuration
- `lib/api-zod` — generated Zod API contracts and types used by the server
- `lib/db` — shared PostgreSQL/Drizzle database package and schema entrypoint
- `tsconfig.base.json`, `pnpm-workspace.yaml`, `package.json` — workspace configuration needed by the package manifests

Generated output, `node_modules`, and TypeScript build-info files are intentionally excluded.

## Workspace relationship

The backend package is `@workspace/api-server` and imports `@workspace/api-zod` and `@workspace/db` through the pnpm workspace. This is a source package for the existing monorepo layout; it is not presented as an independent server with copied dependencies.

## Run in the monorepo

Set the required database connection environment variable, then run from the workspace root:

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
```

The server exposes the API routes under `/api`, including health, property search, and pincode insight endpoints.
