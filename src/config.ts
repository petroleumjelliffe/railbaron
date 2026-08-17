/**
 * The game server's port when no full URL is given.
 *
 * 4001 is Rail Baron's slot in the cross-game port registry — canonical in
 * the game-host repo's PORTS.md: servers count up from 4001, dev clients
 * from 7931.
 */
export const DEFAULT_SERVER_PORT = '4001';

/**
 * The server this client speaks to.
 *
 * Two knobs, and the difference matters:
 *
 * - `VITE_SERVER_URL` is the whole address, and production sets it at build
 *   time to the deployed service.
 * - `VITE_SERVER_PORT` moves only the port and **keeps the hostname
 *   derivation**, which is what development wants. The hostname comes from
 *   `window.location` rather than being `localhost` so that a phone on the
 *   same wifi reaches the dev server on this machine: typing the laptop's IP
 *   into the phone gets a client that then talks to the laptop, not to the
 *   phone itself. Pinning a full URL to `http://localhost:<port>` would
 *   quietly break exactly that case, which is why the port has its own knob.
 *
 * The port is worth moving because the sibling Acquire server defaults to
 * 3001 as well, and two dev servers cannot both have it.
 */
export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL
  ?? `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT ?? DEFAULT_SERVER_PORT}`;
