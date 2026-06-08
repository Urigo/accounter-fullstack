// Bootstraps TypeScript execution for `node --import ./scripts/register-esm.js <file>.ts`.
// Uses tsx (the repo-wide standard TS runner) instead of ts-node: tsx is actively
// maintained, Node 26 compatible, and resolves the project's `.js`-suffixed imports of
// `.ts` source files — which Node's native type stripping does not do.
import { register } from 'tsx/esm/api';

register();
