export const env = {
  // Empty in dev — requests stay relative and go through Vite's /api proxy (vite.config.ts) to
  // the server. Set to the deployed Render URL in Vercel's env vars for prod, where client and
  // server are different origins.
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
};
