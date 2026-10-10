import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer";
import { GoogleCloudAuthPlugin, ReorientationPlugin } from "3d-tiles-renderer/plugins";

/**
 * Streams Google Photorealistic 3D Tiles (the same 3D city you see in Google
 * Earth / Maps 3D) centred on the incident lat/lng. The scene origin (0,0,0)
 * becomes the exact incident point, so actors and vehicles stay in place.
 */
export function GooglePhotorealTiles({
  lat,
  lng,
  onError,
  onReady,
}: {
  lat: number;
  lng: number;
  onError?: (msg: string) => void;
  onReady?: () => void;
}) {
  const { camera, gl } = useThree();
  const groundFound = useRef(false);
  const frame = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);

  const tiles = useMemo(() => {
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
    const t = new TilesRenderer();
    t.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: key ?? "", autoRefreshToken: true }));
    t.registerPlugin(
      new ReorientationPlugin({ lat: THREE.MathUtils.degToRad(lat), lon: THREE.MathUtils.degToRad(lng), height: 0, up: "+y", recenter: true }),
    );
    t.errorTarget = 6; // sharper tiles near the camera
    return t;
  }, [lat, lng]);

  useEffect(() => {
    groundFound.current = false;
    frame.current = 0;
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, gl);
    const handleErr = (e: { error?: Error }) => onError?.(e?.error?.message ?? "Google 3D tiles failed to load");
    const handleModel = ({ scene }: { scene: THREE.Object3D }) => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.receiveShadow = true;
          const mat = m.material as THREE.Material & { fog?: boolean };
          if (mat) mat.fog = false;
        }
      });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyTiles = tiles as any;
    anyTiles.addEventListener("load-error", handleErr);
    anyTiles.addEventListener("load-model", handleModel);
    return () => {
      anyTiles.removeEventListener("load-error", handleErr);
      anyTiles.removeEventListener("load-model", handleModel);
      tiles.dispose();
    };
  }, [tiles, camera, gl, onError]);

  useFrame(() => {
    camera.updateMatrixWorld();
    tiles.setResolutionFromRenderer(camera, gl);
    tiles.update();
    // Google heights are ellipsoidal, not sea-level — drop the city so the
    // real street surface at the incident point sits at y = 0.
    if (!groundFound.current && ++frame.current % 20 === 0) {
      ray.set(new THREE.Vector3(0, 2000, 0), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(tiles.group, true)[0];
      if (hit) {
        tiles.group.position.y -= hit.point.y;
        groundFound.current = true;
        onReady?.();
      }
    }
  });

  return <primitive object={tiles.group} />;
}
