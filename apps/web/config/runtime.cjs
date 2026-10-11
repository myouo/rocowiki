/** Build-time configuration. Native production builds must have explicit origins. */
function httpsOrigin(value, name) {
  if (!value || !value.trim()) throw new Error(`Missing production configuration: ${name}`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid production origin: ${name}`); }
  if (value !== value.trim() || /\s/.test(value) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`Invalid production origin: ${name} must be an HTTPS origin without credentials, path, query or fragment`);
  }
  return url.origin;
}
function resolveRuntimeConfig(env) {
  const production = env.NODE_ENV === 'production';
  const workspaceMode = env.WIKI_WORKSPACE_MODE || (production ? 'server' : 'demo');
  if (!['server', 'demo'].includes(workspaceMode)) throw new Error('WIKI_WORKSPACE_MODE must be server or demo');
  return {
    url: production ? httpsOrigin(env.SITE_URL, 'SITE_URL') : env.SITE_URL || env.WIKI_URL || 'https://wiki.example.app',
    apiOrigin: production ? httpsOrigin(env.API_ORIGIN, 'API_ORIGIN') : env.API_ORIGIN || 'http://localhost:8787',
    workspaceMode,
    workspaceModeExplicit: Boolean(env.WIKI_WORKSPACE_MODE),
  };
}
module.exports = {resolveRuntimeConfig};
