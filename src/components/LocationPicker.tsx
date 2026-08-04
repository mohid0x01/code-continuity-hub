import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Crosshair } from "lucide-react";
import { resolvePickedPoint } from "@/lib/location-scene.functions";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

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
 * Uses Google Places API (New) via the browser key.
 */
export function LocationPicker({
  onChange,
  initial,
}: {
  onChange: (loc: PickedLocation | null) => void;
  initial?: Partial<PickedLocation>;
}) {
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
  const sessionRef = useRef<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Wait for Google Maps Places lib
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (window.google?.maps?.importLibrary) {
        try {
          await window.google.maps.importLibrary("places");
          if (!cancelled) {
            sessionRef.current = new window.google.maps.places.AutocompleteSessionToken();
            setReady(true);
          }
        } catch {
          /* try again */
        }
      } else if (!cancelled) {
        setTimeout(tick, 250);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced city autocomplete
  useEffect(() => {
    if (!ready || !cityInput || cityInput.length < 2) {
      setCitySuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const { suggestions } =
          await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: cityInput,
            includedRegionCodes: ["PK"],
            includedPrimaryTypes: ["locality", "administrative_area_level_2", "administrative_area_level_3"],
            sessionToken: sessionRef.current,
          });
        setCitySuggestions(
          (suggestions ?? []).slice(0, 6).map((s: any) => ({
            placeId: s.placePrediction?.placeId ?? "",
            primary: s.placePrediction?.mainText?.text ?? "",
            secondary: s.placePrediction?.secondaryText?.text ?? "",
          })),
        );
      } catch (err) {
        console.error("City autocomplete", err);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [cityInput, ready]);

  // Debounced area autocomplete biased to selected city
  useEffect(() => {
    if (!ready || !selectedCity || !areaInput || areaInput.length < 2) {
      setAreaSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const { suggestions } =
          await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: areaInput,
            includedRegionCodes: ["PK"],
            locationBias: {
              center: { lat: selectedCity.lat, lng: selectedCity.lng },
              radius: 25000,
            },
            sessionToken: sessionRef.current,
          });
        setAreaSuggestions(
          (suggestions ?? []).slice(0, 6).map((s: any) => ({
            placeId: s.placePrediction?.placeId ?? "",
            primary: s.placePrediction?.mainText?.text ?? "",
            secondary: s.placePrediction?.secondaryText?.text ?? "",
          })),
        );
      } catch (err) {
        console.error("Area autocomplete", err);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [areaInput, selectedCity, ready]);

  // Debounced street/landmark autocomplete — the "exact spot" tier.
  useEffect(() => {
    if (!ready || !selectedCity || !spotInput || spotInput.length < 2) {
      setSpotSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const center = picked
          ? { lat: picked.latitude, lng: picked.longitude }
          : { lat: selectedCity.lat, lng: selectedCity.lng };
        const { suggestions } =
          await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: spotInput,
            includedRegionCodes: ["PK"],
            locationBias: { center, radius: 12000 },
            sessionToken: sessionRef.current,
          });
        setSpotSuggestions(
          (suggestions ?? []).slice(0, 6).map((s: any) => ({
            placeId: s.placePrediction?.placeId ?? "",
            primary: s.placePrediction?.mainText?.text ?? "",
            secondary: s.placePrediction?.secondaryText?.text ?? "",
          })),
        );
      } catch (err) {
        console.error("Spot autocomplete", err);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [spotInput, selectedCity, picked, ready]);

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
        const resolved = await resolvePickedPoint({ data: { lat, lng } });
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
    [areaInput, onChange, selectedCity],
  );

  // Interactive confirmation map with a draggable pin (exact lat/lng control).
  useEffect(() => {
    if (!ready || !picked || !mapRef.current) return;
    const center = { lat: picked.latitude, lng: picked.longitude };
    const run = async () => {
      await window.google.maps.importLibrary("maps");
      await window.google.maps.importLibrary("marker");
      if (!mapObjRef.current) {
        mapObjRef.current = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 17,
          mapTypeId: "hybrid",
          disableDefaultUI: true,
          zoomControl: true,
        });
        markerRef.current = new window.google.maps.Marker({
          map: mapObjRef.current,
          position: center,
          draggable: true,
        });
        markerRef.current.addListener("dragend", (e: any) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          void commitPoint(lat, lng, "Pin adjusted by officer", "exact");
        });
        mapObjRef.current.addListener("click", (e: any) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          markerRef.current.setPosition({ lat, lng });
          void commitPoint(lat, lng, "Pin adjusted by officer", "exact");
        });
      } else {
        mapObjRef.current.setCenter(center);
        markerRef.current?.setPosition(center);
      }
    };
    void run();
    // Only re-centre when the coordinate itself changes.
  }, [ready, picked?.latitude, picked?.longitude, commitPoint, picked]);

  const pickCity = async (s: Suggestion) => {
    setLoading(true);
    try {
      const Place = window.google.maps.places.Place;
      const place = new Place({ id: s.placeId });
      await place.fetchFields({ fields: ["displayName", "location"] });
      const lat = place.location?.lat?.() ?? 0;
      const lng = place.location?.lng?.() ?? 0;
      setSelectedCity({
        placeId: s.placeId,
        name: s.primary,
        lat,
        lng,
      });
      setCityInput(s.primary);
      setCitySuggestions([]);
      setAreaInput("");
      setPicked(null);
      onChange(null);
    } catch (err) {
      console.error("Fetch city details", err);
    } finally {
      setLoading(false);
    }
  };

  const pickArea = async (s: Suggestion) => {
    if (!selectedCity) return;
    setLoading(true);
    try {
      const Place = window.google.maps.places.Place;
      const place = new Place({ id: s.placeId });
      await place.fetchFields({ fields: ["formattedAddress", "location", "displayName"] });
      const lat = place.location?.lat?.() ?? 0;
      const lng = place.location?.lng?.() ?? 0;
      const next: PickedLocation = {
        city: selectedCity.name,
        area: s.primary,
        formattedAddress: place.formattedAddress ?? `${s.primary}, ${selectedCity.name}`,
        latitude: lat,
        longitude: lng,
        precision: "area",
      };
      setAreaInput(s.primary);
      setAreaSuggestions([]);
      setPicked(next);
      onChange(next);
    } catch (err) {
      console.error("Fetch area details", err);
    } finally {
      setLoading(false);
    }
  };

  const pickSpot = async (s: Suggestion) => {
    setLoading(true);
    try {
      const Place = window.google.maps.places.Place;
      const place = new Place({ id: s.placeId });
      await place.fetchFields({ fields: ["formattedAddress", "location", "displayName"] });
      const lat = place.location?.lat?.() ?? 0;
      const lng = place.location?.lng?.() ?? 0;
      setSpotInput(s.primary);
      setSpotSuggestions([]);
      await commitPoint(lat, lng, place.formattedAddress ?? s.primary, "exact");
    } catch (err) {
      console.error("Fetch spot details", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
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
              setSelectedCity(null);
              setPicked(null);
              onChange(null);
            }}
            placeholder={ready ? "e.g. Karachi, Lahore, Khairpur" : "Loading Google Maps…"}
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
                  <button
                    type="button"
                    onClick={() => pickCity(s)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <span>
                      <span className="text-text-primary">{s.primary}</span>
                      <span className="ml-1 text-xs text-text-muted">{s.secondary}</span>
                    </span>
                  </button>
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
              setPicked(null);
              onChange(null);
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
                  <button
                    type="button"
                    onClick={() => pickArea(s)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <span>
                      <span className="text-text-primary">{s.primary}</span>
                      <span className="ml-1 text-xs text-text-muted">{s.secondary}</span>
                    </span>
                  </button>
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
                  <button
                    type="button"
                    onClick={() => pickSpot(s)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <span>
                      <span className="text-text-primary">{s.primary}</span>
                      <span className="ml-1 text-xs text-text-muted">{s.secondary}</span>
                    </span>
                  </button>
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