import { useMemo, useRef } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneStore } from "@/stores/sceneStore";
import type { Tables } from "@/integrations/supabase/types";
import incidentCarModel from "@/assets/models/incident-car.glb.asset.json";

type SceneEntity = Tables<"scene_entities">;
type SceneEvent = Tables<"scene_events">;

export function RealisticVehicle({ entity, events }: { entity: SceneEntity; events: SceneEvent[] }) {
  const { scene } = useGLTF(incidentCarModel.url);
  const rootRef = useRef<THREE.Group>(null);
  const currentEvent = useSceneStore((state) => state.currentEvent);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.metalness = Math.max(material.metalness, 0.32);
            material.roughness = Math.min(material.roughness, 0.42);
            material.envMapIntensity = 1.15;
          }
        }
      }
    });
    const initial = new THREE.Box3().setFromObject(clone);
    const size = initial.getSize(new THREE.Vector3());
    clone.scale.setScalar(4.35 / Math.max(size.x, size.z, 0.001));
    const bounds = new THREE.Box3().setFromObject(clone);
    const center = bounds.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -bounds.min.y + 0.03, -center.z);
    return clone;
  }, [scene]);
  const positions = useMemo(() => {
    if (events.length === 0) return [[entity.position_x || 0, 0, entity.position_z || 0]];
    let position = [entity.position_x || 0, 0, entity.position_z || 0];
    const result: number[][] = [];
    for (let index = 0; index < events.length; index += 1) {
      const event = events.find((candidate) => candidate.sequence_number === index + 1 && candidate.entity_id === entity.id);
      if (event) position = [event.dest_x ?? position[0], 0, event.dest_z ?? position[2]];
      result.push([...position]);
    }
    return result;
  }, [entity, events]);
  const target = useMemo(() => {
    const point = positions[Math.min(currentEvent, positions.length - 1)] || [0, 0, 0];
    return new THREE.Vector3(point[0], 0, point[2]);
  }, [currentEvent, positions]);

  useFrame((_, delta) => {
    const root = rootRef.current;
    if (!root) return;
    const previous = root.position.clone();
    root.position.lerp(target, 1 - Math.exp(-delta * 3.8));
    const direction = root.position.clone().sub(previous);
    if (direction.lengthSq() > 0.00002) {
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, Math.atan2(direction.x, direction.z), 1 - Math.exp(-delta * 6));
    }
  });

  return (
    <group ref={rootRef} position={[positions[0]?.[0] || 0, 0, positions[0]?.[2] || 0]}>
      <primitive object={model} />
      <Html distanceFactor={15} position={[0, 2.1, 0]} center>
        <div className="scene-entity-label border-gold/60">{entity.label}</div>
      </Html>
    </group>
  );
}
