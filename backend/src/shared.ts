/**
 * Single bridge to the `@universe-sim/shared` package.
 *
 * Everything in `backend/` imports shared constants/types from here. Centralizing
 * the path means the rest of the codebase never hard-codes a cross-package
 * relative path, and it runs natively under Node (no build step, no symlink
 * dependency on `node_modules`).
 */
export * from "../../shared/src/index.ts";
