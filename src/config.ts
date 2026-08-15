/**
 * The server this client speaks to.
 *
 * The hostname rather than `localhost`, so a phone on the same wifi reaches a
 * dev server running on this machine — typing the laptop's IP into the phone
 * gets a client that then talks to the laptop, not to the phone itself.
 * Production sets VITE_SERVER_URL at build time.
 */
export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ?? `http://${window.location.hostname}:3001`;
