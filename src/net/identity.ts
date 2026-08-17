import { createIdentityStore } from '../../vendor/lobby/client/identity';

/**
 * The one identity store, shared by every online surface: `useRoom` reads the
 * seat token through it, and the join board writes the optional name through
 * it so the lobby's join carries what was typed.
 *
 * Namespaced: both games share the GitHub Pages origin, so an unprefixed key
 * would have Acquire and Rail Baron overwriting each other's identities.
 */
export const identity = createIdentityStore('railbaron');
