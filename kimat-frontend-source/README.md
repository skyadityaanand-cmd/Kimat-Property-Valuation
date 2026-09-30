# Kimat frontend source

This archive contains the Kimat web frontend and the shared generated React API client it imports.

## Included

- `artifacts/kimat` — Vite/React frontend source, styling, public assets, and artifact configuration
- `lib/api-client-react` — generated React Query hooks and API types used by the frontend
- `tsconfig.base.json`, `pnpm-workspace.yaml`, `package.json` — workspace configuration needed by the package manifests

Generated output, `node_modules`, and TypeScript build-info files are intentionally excluded.

## Workspace relationship

The frontend package is `@workspace/kimat` and imports `@workspace/api-client-react` through the pnpm workspace. This is a source package for the existing monorepo layout; it is not presented as an independent app with a copied `node_modules` directory.

## Run in the monorepo

From the workspace root:

```bash
pnpm install
pnpm --filter @workspace/kimat run dev
```

The frontend expects the API routes at `/api/search`, `/api/pincode-insight`, and `/api/healthz`, normally provided by the Kimat API server.
