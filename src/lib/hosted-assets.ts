const LOVABLE_PRIMARY_HOSTS = new Set(["scene-iq.dev", "www.scene-iq.dev"]);

export function selectHostedAssetUrl(
  hostedUrl: string,
  localUrl: string,
  hostname: string,
  isDevelopment = false,
): string {
  if (isDevelopment || !hostname) return localUrl;
  const isLovableHost = LOVABLE_PRIMARY_HOSTS.has(hostname)
    || hostname === "localhost"
    || hostname.endsWith(".lovable.app")
    || hostname.endsWith(".lovable.dev");
  return isLovableHost ? hostedUrl : localUrl;
}

export function hostedAssetUrl(hostedUrl: string, localUrl: string): string {
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  return selectHostedAssetUrl(hostedUrl, localUrl, hostname, import.meta.env.DEV);
}
