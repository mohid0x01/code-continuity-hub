import { describe, expect, it } from 'vitest';
import { googleMapsRequest } from '@/lib/google-maps-request';

describe('Google Maps credential selection', () => {
  it('uses the explicitly supplied provider key for Places without requiring connector credentials', () => {
    const request = googleMapsRequest('/places/v1/places:autocomplete', { providerKey: 'test-provider' }, { method: 'POST', headers: { 'X-Goog-FieldMask': 'suggestions.placePrediction.placeId' } });
    expect(request?.url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(request?.init.headers.get('X-Goog-Api-Key')).toBe('test-provider');
    expect(request?.init.headers.has('Authorization')).toBe(false);
    expect(request?.init.headers.get('X-Goog-FieldMask')).toBe('suggestions.placePrediction.placeId');
  });
  it('routes legacy geocoding and Roads to their correct provider hosts', () => {
    expect(googleMapsRequest('/maps/api/geocode/json?latlng=24,67', { providerKey: 'test-provider' })?.url).toBe('https://maps.googleapis.com/maps/api/geocode/json?latlng=24%2C67&key=test-provider');
    expect(googleMapsRequest('/roads/v1/nearestRoads?points=24,67', { providerKey: 'test-provider' })?.url).toBe('https://roads.googleapis.com/v1/nearestRoads?points=24%2C67&key=test-provider');
  });
  it('keeps connector credentials on the gateway when no custom provider key was supplied', () => {
    const request = googleMapsRequest('/places/v1/places:autocomplete', { connectorKey: 'test-connection', lovableKey: 'test-lovable' });
    expect(request?.url).toBe('https://connector-gateway.lovable.dev/google_maps/places/v1/places:autocomplete');
    expect(request?.init.headers.get('X-Connection-Api-Key')).toBe('test-connection');
    expect(request?.init.headers.get('Authorization')).toBe('Bearer test-lovable');
    expect(googleMapsRequest('/places/v1/places:autocomplete', {})).toBeNull();
  });
});