import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { RealWorldScene } from "@/lib/location-scene.functions";

/** Imagery supplies ground context only; building height still comes from geometry. */
export function MapGround({ scene }: { scene: RealWorldScene }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!scene.staticMapUrl || !scene.staticMapPlacement) return;
    let active = true;
    let loaded: THREE.Texture | undefined;
    new THREE.TextureLoader().load(scene.staticMapUrl, (next) => {
      loaded = next;
      next.colorSpace = THREE.SRGBColorSpace;
      if (active) setTexture(next);
      else next.dispose();
    }, undefined, () => { if (active) setTexture(null); });
    return () => { active = false; loaded?.dispose(); setTexture(null); };
  }, [scene.staticMapUrl, scene.staticMapPlacement]);
  const placement = scene.staticMapPlacement;
  if (!texture || !placement) return null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[placement.offsetX, -0.015, placement.offsetZ]} receiveShadow>
        <planeGeometry args={[placement.widthMeters, placement.widthMeters]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      <Html position={[placement.offsetX, 0.1, placement.offsetZ + placement.widthMeters / 2]} center>
        <span className="whitespace-nowrap bg-background/80 px-2 py-1 text-[10px] text-foreground">
          {placement.attribution}
        </span>
      </Html>
    </group>
  );
}