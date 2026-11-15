import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import asphaltDiffuse from "@/assets/textures/asphalt_02_diff_1k.jpg.asset.json";
import asphaltNormal from "@/assets/textures/asphalt_02_nor_gl_1k.jpg.asset.json";
import asphaltRoughness from "@/assets/textures/asphalt_02_rough_1k.jpg.asset.json";
import concreteDiffuse from "@/assets/textures/concrete_wall_006_diff_1k.jpg.asset.json";
import concreteNormal from "@/assets/textures/concrete_wall_006_nor_gl_1k.jpg.asset.json";
import concreteRoughness from "@/assets/textures/concrete_wall_006_rough_1k.jpg.asset.json";

const urls = [
  asphaltDiffuse.url,
  asphaltNormal.url,
  asphaltRoughness.url,
  concreteDiffuse.url,
  concreteNormal.url,
  concreteRoughness.url,
];

export function useSceneMaterials() {
  const textures = useTexture(urls);
  useEffect(() => {
    textures.forEach((texture, index) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      if (index === 0 || index === 3) texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    });
  }, [textures]);

  return useMemo(() => {
    const asphalt = new THREE.MeshStandardMaterial({
      map: textures[0],
      normalMap: textures[1],
      normalScale: new THREE.Vector2(0.72, 0.72),
      roughnessMap: textures[2],
      roughness: 0.92,
      metalness: 0.02,
      color: "#a7a9aa",
    });
    asphalt.map!.repeat.set(8, 1);
    asphalt.normalMap!.repeat.set(8, 1);
    asphalt.roughnessMap!.repeat.set(8, 1);

    const concrete = new THREE.MeshStandardMaterial({
      map: textures[3],
      normalMap: textures[4],
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughnessMap: textures[5],
      roughness: 0.86,
      metalness: 0.01,
      color: "#d1cbc0",
    });
    concrete.map!.repeat.set(2, 3);
    concrete.normalMap!.repeat.set(2, 3);
    concrete.roughnessMap!.repeat.set(2, 3);
    return { asphalt, concrete };
  }, [textures]);
}

export function disposeSceneMaterials(materials: { asphalt: THREE.Material; concrete: THREE.Material }) {
  materials.asphalt.dispose();
  materials.concrete.dispose();
}
