/** Provider keys and connector keys are different credentials; never interchange them. */
export function googleMapsRequest(
  path: string,
  credentials: { providerKey?: string; connectorKey?: string; lovableKey?: string },
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  if (credentials.providerKey) {
    const places = path.startsWith('/places/');
    const roads = path.startsWith('/roads/');
    const url = new URL(
      places ? path.slice('/places'.length) : roads ? path.slice('/roads'.length) : path,
      places ? 'https://places.googleapis.com' : roads ? 'https://roads.googleapis.com' : 'https://maps.googleapis.com',
    );
    headers.delete('Authorization');
    headers.delete('X-Connection-Api-Key');
    if (places) headers.set('X-Goog-Api-Key', credentials.providerKey);
    else url.searchParams.set('key', credentials.providerKey);
    return { url: url.toString(), init: { ...init, headers } };
  }
  if (!credentials.connectorKey || !credentials.lovableKey) return null;
  headers.set('Authorization', `Bearer ${credentials.lovableKey}`);
  headers.set('X-Connection-Api-Key', credentials.connectorKey);
  return { url: `https://connector-gateway.lovable.dev/google_maps${path}`, init: { ...init, headers } };
}