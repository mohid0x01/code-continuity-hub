// Vercel runs the MCP server in Node.js, where the optional Cloudflare env
// binding does not exist. The MCP recorder reads process.env before this
// fallback, so an empty binding preserves Vercel environment-variable handling.
export const env: Record<string, string | undefined> = Object.freeze({});
