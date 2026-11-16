import { useLayoutEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { WeaponKind } from "@/lib/scene-context";
import pistolHosted from "@/assets/models/forensic-pistol.glb.asset.json";
import rifleHosted from "@/assets/models/forensic-rifle.glb.asset.json";
import shotgunHosted from "@/assets/models/forensic-shotgun.glb.asset.json";
import smgHosted from "@/assets/models/forensic-smg.glb.asset.json";
import pistolLocal from "@/assets/models/forensic-pistol.glb?url";
import rifleLocal from "@/assets/models/forensic-rifle.glb?url";
import shotgunLocal from "@/assets/models/forensic-shotgun.glb?url";
import smgLocal from "@/assets/models/forensic-smg.glb?url";

const MODELS = {
  pistol: { hosted: pistolHosted.url, local: pistolLocal, length: 0.25 },
  rifle: { hosted: rifleHosted.url, local: rifleLocal, length: 0.92 },
  shotgun: { hosted: shotgunHosted.url, local: shotgunLocal, length: 0.96 },
  smg: { hosted: smgHosted.url, local: smgLocal, length: 0.56 },
} satisfies Record<WeaponKind, { hosted: string; local: string; length: number }>;

export function WeaponAttachment({ kind, hand, actorRoot }: {
  kind: WeaponKind;
  hand: THREE.Object3D;
  actorRoot: THREE.Object3D;
}) {
  const config = MODELS[kind];
  const { scene } = useGLTF(import.meta.env.DEV ? config.local : config.hosted);
  const weapon = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const source = Array.isArray(child.material) ? child.material : [child.material];
      const materials = source.map((material) => {
        const copy = material.clone();
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.metalness = Math.max(copy.metalness, 0.72);
          copy.roughness = Math.min(copy.roughness, 0.34);
          copy.envMapIntensity = 1.2;
          copy.color.multiplyScalar(0.62);
        }
        return copy;
      });
      child.material = Array.isArray(child.material) ? materials : materials[0];
    });
    clone.updateMatrixWorld(true);
    const initial = new THREE.Box3().setFromObject(clone);
    const size = initial.getSize(new THREE.Vector3());
    if (size.x >= size.y && size.x >= size.z) clone.rotation.y = Math.PI / 2;
    else if (size.y >= size.x && size.y >= size.z) clone.rotation.x = Math.PI / 2;
    clone.updateMatrixWorld(true);
    const rotated = new THREE.Box3().setFromObject(clone);
    const rotatedSize = rotated.getSize(new THREE.Vector3());
    clone.scale.setScalar(config.length / Math.max(rotatedSize.x, rotatedSize.y, rotatedSize.z, 0.001));
    clone.updateMatrixWorld(true);
    const centered = new THREE.Box3().setFromObject(clone);
    const center = centered.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    clone.name = `FIR_${kind}_hand_attachment`;
    return clone;
  }, [scene, config.length, kind]);

  useLayoutEffect(() => {
    actorRoot.updateWorldMatrix(true, true);
    hand.updateWorldMatrix(true, false);
    weapon.updateMatrixWorld(true);
    const handPosition = hand.getWorldPosition(new THREE.Vector3());
    const actorRotation = actorRoot.getWorldQuaternion(new THREE.Quaternion());
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(actorRotation);
    weapon.position.copy(handPosition).addScaledVector(forward, config.length * 0.18);
    weapon.quaternion.copy(actorRotation);
    weapon.updateMatrixWorld(true);
    hand.attach(weapon);
    return () => {
      weapon.removeFromParent();
      weapon.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      });
    };
  }, [actorRoot, hand, weapon, config.length]);

  return null;
}
