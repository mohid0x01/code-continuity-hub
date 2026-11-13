import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Crosshair } from "lucide-react";
import { resolvePickedPoint, searchPlaces, getPlaceDetails } from "@/lib/location-scene.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PickedLocation = {
  city: string;
  area: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  /** How precise the saved coordinate is — drives 3D scene radius selection. */
  precision?: "city" | "area" | "exact";
};

type Suggestion = { placeId: string; primary: string; secondary: string };

/**
 * Cascading Pakistan location picker:
 *  1. City / District autocomplete (restricted to PK, admin level)
 *  2. Area / Locality autocomplete biased to that city
 * Search runs through authenticated OpenStreetMap geocoding; the picker map uses OSM tiles.
 */
export function LocationPicker({
  onChange,
  initial,
}: {
  onChange: (loc: PickedLocation | null) => void;
  initial?: Partial<PickedLocation>;
}) {
  const searchPlacesFn = useServerFn(searchPlaces);
  const getPlaceDetailsFn = useServerFn(getPlaceDetails);
  const resolvePointFn = useServerFn(resolvePickedPoint);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cityInput, setCityInput] = useState(initial?.city ?? "");
  const [areaInput, setAreaInput] = useState(initial?.area ?? "");
  const [citySuggestions, setCitySuggestions] = useState<Suggestion[]>([]);
  const [areaSuggestions, setAreaSuggestions] = useState<Suggestion[]>([]);
  const [selectedCity, setSelectedCity] = useState<{
    placeId: string;
    name: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [spotInput, setSpotInput] = useState("");
  const [spotSuggestions, setSpotSuggestions] = useState<Suggestion[]>([]);
  const [satUrl, setSatUrl] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Places search is server-side, so inputs are usable immediately.
  useEffect(() => {
    setReady(true);
  }, []);

  // Debounced city autocomplete
  useEffect(() => {
    if (!ready || !cityInput || cityInput.length < 2 || cityInput === selectedCity?.name) {
      setCitySuggestions([]);
      return;
    }
    let active = true;
    const handle = setTimeout(async () => {
      setError(null);
      try {
        const list = await searchPlacesFn({
          data: {
            input: cityInput,
            primaryTypes: ["locality", "administrative_area_level_2", "administrative_area_level_3"],
          },
        });
        if (active) setCitySuggestions(list);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Location search unavailable. Please try again.");
      }
    }, 300);
    return () => { active = false; clearTimeout(handle); };
  }, [cityInput, ready, selectedCity, searchPlacesFn]);

  // Debounced area autocomplete biased to selected city
  useEffect(() => {
    if (!ready || !selectedCity || !areaInput || areaInput.length < 2) {
      setAreaSuggestions([]);
      return;
    }
    let active = true;
    const handle = setTimeout(async () => {
      setError(null);
      try {
        const list = await searchPlacesFn({
          data: {
            input: areaInput,
            bias: { lat: selectedCity.lat, lng: selectedCity.lng, radius: 25000 },
          },
        });
        if (active) setAreaSuggestions(list);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Location search unavailable. Please try again.");
      }
    }, 300);
    return () => { active = false; clearTimeout(handle); };
  }, [areaInput, selectedCity, ready, searchPlacesFn]);

  // Debounced street/landmark autocomplete — the "exact spot" tier.
  useEffect(() => {
    if (!ready || !selectedCity || !spotInput || spotInput.length < 2) {
      setSpotSuggestions([]);
      return;
    }
    let active = true;
    const handle = setTimeout(async () => {
      setError(null);
      try {
        const center = picked
          ? { lat: picked.latitude, lng: picked.longitude }
          : { lat: selectedCity.lat, lng: selectedCity.lng };
        const list = await searchPlacesFn({
          data: { input: spotInput, bias: { ...center, radius: 12000 } },
        });
        if (active) setSpotSuggestions(list);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Location search unavailable. Please try again.");
      }
    }, 300);
    return () => { active = false; clearTimeout(handle); };
  }, [spotInput, selectedCity, picked, ready, searchPlacesFn]);

  /** Commits an exact coordinate: reverse-geocodes it server-side and pins the map. */
  const commitPoint = useCallback(
    async (lat: number, lng: number, label: string, precision: PickedLocation["precision"]) => {
      const base: PickedLocation = {
        city: selectedCity?.name ?? "",
        area: areaInput || label,
        formattedAddress: label,
        latitude: lat,
        longitude: lng,
        precision,
      };
      setPicked(base);
      onChange(base);
      try {
        const resolved = await resolvePointFn({ data: { lat, lng } });
        setSatUrl(resolved.staticMapUrl ?? null);
        if (resolved.address) {
          const next = { ...base, formattedAddress: resolved.address };
          setPicked(next);
          onChange(next);
        }
      } catch (err) {
        console.warn("Reverse geocode failed", err);
      }
    },
    [areaInput, onChange, selectedCity, resolvePointFn],
  );

  // Interactive OpenStreetMap preview with a draggable pin (exact lat/lng control).
  useEffect(() => {
    if (!ready || !picked || !mapRef.current) return;
    const mapContainer = mapRef.current;
    const center = { lat: picked.latitude, lng: picked.longitude };
    let active = true;
    const run = async () => {
      setMapError(null);
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (!active) return;
      if (!mapObjRef.current) {
        mapObjRef.current = leaflet.map(mapContainer, { zoomControl: true }).setView([center.lat, center.lng], 17);
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapObjRef.current);
        markerRef.current = leaflet.marker([center.lat, center.lng], { draggable: true }).addTo(mapObjRef.current);
        markerRef.current.on("dragend", () => {
          const point = markerRef.current?.getLatLng();
          if (!point) return;
          const { lat, lng } = point;
          void commitPoint(lat, lng, "Pin adjusted by officer", "exact");
        });
        mapObjRef.current.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng } = event.latlng;
          markerRef.current.setLatLng([lat, lng]);
          void commitPoint(lat, lng, "Pin adjusted by officer", "exact");
        });
      } else {
        mapObjRef.current.setView([center.lat, center.lng], 17);
        markerRef.current?.setLatLng([center.lat, center.lng]);
        window.setTimeout(() => mapObjRef.current?.invalidateSize(), 0);
      }
    };
    void run().catch((err) => {
      if (active) setMapError(err instanceof Error ? err.message : "Free map preview unavailable. Your selected coordinates are still saved.");
    });
    return () => { active = false; };
    // Only re-centre when the coordinate itself changes.
  }, [ready, picked?.latitude, picked?.longitude, commitPoint, picked]);

  useEffect(() => () => mapObjRef.current?.remove?.(), []);

  const pickCity = async (s: Suggestion) => {
    setLoading(true);
    try {
      const place = await getPlaceDetailsFn({ data: { placeId: s.placeId } });
      if (!place) throw new Error("Place details unavailable");
      const { lat, lng } = place;
      setSelectedCity({
        placeId: s.placeId,
        name: s.primary,
        lat,
        lng,
      });
      setCityInput(s.primary);
      setCitySuggestions([]);
      setAreaInput("");
      setSpotInput("");
      setAreaSuggestions([]);
      setSpotSuggestions([]);
      setSatUrl(null);
      const cityLocation: PickedLocation = {
        city: s.primary,
        area: s.primary,
        formattedAddress: place.formattedAddress || `${s.primary}, Pakistan`,
        latitude: lat,
        longitude: lng,
        precision: "city",
      };
      setPicked(cityLocation);
      onChange(cityLocation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to select this location.");
    } finally {
      setLoading(false);
    }
  };

  const pickArea = async (s: Suggestion) => {
    if (!selectedCity) return;
    setLoading(true);
    try {
      const place = await getPlaceDetailsFn({ data: { placeId: s.placeId } });
      if (!place) throw new Error("Place details unavailable");
      const { lat, lng } = place;
      const next: PickedLocation = {
        city: selectedCity.name,
        area: s.primary,
        formattedAddress: place.formattedAddress || `${s.primary}, ${selectedCity.name}`,
        latitude: lat,
        longitude: lng,
        precision: "area",
      };
      setAreaInput(s.primary);
      setAreaSuggestions([]);
      setPicked(next);
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to select this location.");
    } finally {
      setLoading(false);
    }
  };

  const pickSpot = async (s: Suggestion) => {
    setLoading(true);
    try {
      const place = await getPlaceDetailsFn({ data: { placeId: s.placeId } });
      if (!place) throw new Error("Place details unavailable");
      const { lat, lng } = place;
      setSpotInput(s.primary);
      setSpotSuggestions([]);
      await commitPoint(lat, lng, place.formattedAddress || s.primary, "exact");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to select this location.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {/* CITY */}
      <div className="relative">
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          City / District
        </label>
        <div className="relative mt-2">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => {
              setCityInput(e.target.value);
              setCitySuggestions([]);
              setAreaSuggestions([]);
              setSpotSuggestions([]);
              setAreaInput("");
              setSpotInput("");
              setSatUrl(null);
              setSelectedCity(null);
              setPicked(null);
              onChange(null);
            }}
            placeholder={ready ? "e.g. Karachi, Lahore, Khairpur" : "Preparing location search…"}
            disabled={!ready}
            className="glass-input w-full rounded-[6px] px-4 py-3 pr-10 text-sm placeholder:text-text-muted"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gold" />
          ) : (
            <MapPin className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
          )}
          {citySuggestions.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-[6px] border border-border-accent bg-card shadow-2xl">
              {citySuggestions.map((s) => (
                <li key={s.placeId}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => pickCity(s)}
                    className="h-auto w-full justify-start items-start gap-2 whitespace-normal px-3 py-2 text-left text-sm normal-case tracking-normal"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <span>
                      <span className="text-text-primary">{s.primary}</span>
                      <span className="ml-1 text-xs text-text-muted">{s.secondary}</span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* AREA */}
      <div className="relative">
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          Area / Locality
        </label>
        <div className="relative mt-2">
          <input
            type="text"
            value={areaInput}
            onChange={(e) => {
              setAreaInput(e.target.value);
            }}
            placeholder={
              selectedCity ? `Search areas in ${selectedCity.name}…` : "Pick a city first"
            }
            disabled={!selectedCity}
            className="glass-input w-full rounded-[6px] px-4 py-3 text-sm placeholder:text-text-muted disabled:opacity-50"
          />
          {areaSuggestions.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-[6px] border border-border-accent bg-card shadow-2xl">
              {areaSuggestions.map((s) => (
                <li key={s.placeId}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => pickArea(s)}
                    className="h-auto w-full justify-start items-start gap-2 whitespace-normal px-3 py-2 text-left text-sm normal-case tracking-normal"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <span>
                      <span className="text-text-primary">{s.primary}</span>
                      <span className="ml-1 text-xs text-text-muted">{s.secondary}</span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* EXACT SPOT */}
      <div className="relative">
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
          Exact Spot / Street / Landmark
        </label>
        <div className="relative mt-2">
          <input
            type="text"
            value={spotInput}
            onChange={(e) => setSpotInput(e.target.value)}
            placeholder={selectedCity ? "e.g. Shahi Bazaar chowk, Main Kutchery Road" : "Pick a city first"}
            disabled={!selectedCity}
            className="glass-input w-full rounded-[6px] px-4 py-3 pr-10 text-sm placeholder:text-text-muted disabled:opacity-50"
          />
          <Crosshair className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold" />
          {spotSuggestions.length > 0 && (
            <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-[6px] border border-border-accent bg-card shadow-2xl">
              {spotSuggestions.map((s) => (
                <li key={s.placeId}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => pickSpot(s)}
                    className="h-auto w-full justify-start items-start gap-2 whitespace-normal px-3 py-2 text-left text-sm normal-case tracking-normal"
                  >
                    <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <span>
                      <span className="text-text-primary">{s.primary}</span>
                      <span className="ml-1 text-xs text-text-muted">{s.secondary}</span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {picked && (
        <div className="space-y-3 rounded-[6px] border border-gold/30 bg-gold/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <div className="text-[12px] text-text-secondary">
              <div className="font-semibold text-text-primary">{picked.formattedAddress}</div>
              <div className="mt-0.5 font-mono text-[10px] text-text-muted">
                {picked.latitude.toFixed(6)}, {picked.longitude.toFixed(6)}
                <span className="ml-2 uppercase tracking-wider text-gold">
                  {picked.precision ?? "area"} precision
                </span>
              </div>
              <div className="mt-1 text-[10px] text-text-muted">
                Drag the pin or tap the map to fine-tune the exact incident point.
              </div>
            </div>
          </div>
          {mapError && <p role="status" className="text-xs text-text-secondary">{mapError}</p>}
          <div ref={mapRef} className="h-52 w-full overflow-hidden rounded-[6px] border border-border-subtle" />
          {satUrl && (
            <img
              src={satUrl}
              alt="Satellite preview of the selected incident location"
              className="h-32 w-full rounded-[6px] border border-border-subtle object-cover"
              loading="lazy"
            />
          )}
        </div>
      )}
    </div>
  );
}