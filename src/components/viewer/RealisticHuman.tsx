import { useEffect, useMemo, useRef } from "react";
import { Html, useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useSceneStore } from "@/stores/sceneStore";
import type { Tables } from "@/integrations/supabase/types";
import forensicManModel from "@/assets/models/forensic-man.glb.asset.json";
import forensicCivilianModel from "@/assets/models/forensic-civilian.glb.asset.json";
import forensicManLocal from "@/assets/models/forensic-man.glb?url";
import forensicCivilianLocal from "@/assets/models/forensic-civilian.glb?url";

type SceneEntity = Tables<"scene_entities">;
type SceneEvent = Tables<"scene_events">;
type ActionKind = "walk" | "run" | "attack" | "fall" | "aim" | "grab" | "flee" | "idle";

function classifyAction(label: string | undefined): ActionKind {
  const text = (label || "").toLowerCase();
  if (/(fire|shoot|gun|goli|aim|pistol)/.test(text)) return "aim";
  if (/(hit|attack|stab|strike|beat|assault|hamla|maar|punch)/.test(text)) return "attack";
  if (/(fall|collapse|injur|die|dead|gir|zakhmi)/.test(text)) return "fall";
  if (/(snatch|grab|steal|rob|loot|cheen|pick)/.test(text)) return "grab";
  if (/(flee|escape|run away|farar|bhaag)/.test(text)) return "flee";
  if (/(run|sprint|chase)/.test(text)) return "run";
  if (/(walk|move|approach|arrive|enter|go)/.test(text)) return "walk";
  return "idle";
}

function eventPositions(entity: SceneEntity, events: SceneEvent[]) {
  if (events.length === 0) return [[entity.position_x || 0, entity.position_y || 0, entity.position_z || 0]];
  let position = [entity.position_x || 0, entity.position_y || 0, entity.position_z || 0];
  const result: number[][] = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events.find((candidate) => candidate.sequence_number === index + 1 && candidate.entity_id === entity.id);
    if (event) position = [event.dest_x ?? position[0], event.dest_y ?? position[1], event.dest_z ?? position[2]];
    result.push([...position]);
  }
  return result;
}

function RiggedHuman({ url, sourceScale, entity, events }: { url: string; sourceScale: number; entity: SceneEntity; events: SceneEvent[] }) {
  const { scene, animations } = useGLTF(url);
  const { gl } = useThree();
  const rootRef = useRef<THREE.Group>(null);
  const activeClip = useRef("");
  const currentEvent = useSceneStore((state) => state.currentEvent);
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.roughness = Math.max(0.48, material.roughness);
            material.envMapIntensity = 0.85;
          }
        }
      }
    });
    // These Quaternius GLBs already carry a 100× armature/node transform.
    // Box3 on a SkinnedMesh includes skinned bounds and double-counts that
    // transform, so deriving a second scale from it makes the person tiny.
    clone.scale.setScalar(sourceScale);
    clone.position.set(0, 0, 0);
    return clone;
  }, [scene, sourceScale]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => gl.domElement.parentElement?.setAttribute("data-scene-ready", "true"));
    if (!import.meta.env.DEV) return () => cancelAnimationFrame(frame);
    const debug = () => {
      const root = rootRef.current;
      if (!root) return null;
      const bounds = new THREE.Box3().setFromObject(root);
      return {
        label: entity.label,
        min: bounds.min.toArray(),
        max: bounds.max.toArray(),
        rootPosition: root.position.toArray(),
        modelPosition: model.position.toArray(),
        modelScale: model.scale.toArray(),
      };
    };
    const target = window as unknown as { __sceneHumans?: Array<typeof debug> };
    target.__sceneHumans = [...(target.__sceneHumans ?? []), debug];
    return () => {
      cancelAnimationFrame(frame);
      target.__sceneHumans = (target.__sceneHumans ?? []).filter((candidate) => candidate !== debug);
    };
  }, [gl, model, entity.label]);
  const { actions } = useAnimations(animations, rootRef);
  const positions = useMemo(() => eventPositions(entity, events), [entity, events]);
  const target = useMemo(() => {
    const point = positions[Math.min(currentEvent, positions.length - 1)] || [0, 0, 0];
    return new THREE.Vector3(point[0], point[1], point[2]);
  }, [currentEvent, positions]);
  const action = useMemo<ActionKind>(() => {
    const active = events
      .filter((event) => event.entity_id === entity.id && (event.sequence_number ?? 0) <= currentEvent + 1)
      .sort((a, b) => (b.sequence_number ?? 0) - (a.sequence_number ?? 0))[0];
    return classifyAction(active?.action_label ?? active?.description ?? undefined);
  }, [events, entity.id, currentEvent]);

  useEffect(() => {
    const wanted = action === "fall" ? ["death"]
      : action === "attack" ? ["swordslash", "dagger_attack", "punch"]
        : action === "aim" ? ["attacking_idle", "idle"]
          : action === "grab" ? ["pickup", "punch", "idle"]
            : action === "run" || action === "flee" ? ["run"]
              : action === "walk" ? ["walk"] : ["idle"];
    const clipName = Object.keys(actions).find((name) => {
      const normalized = name.toLowerCase().replace(/[^a-z]/g, "");
      return wanted.some((candidate) => normalized.endsWith(candidate.replace(/[^a-z]/g, "")));
    });
    if (!clipName || activeClip.current === clipName) return;
    const next = actions[clipName];
    if (!next) return;
    const previous = activeClip.current ? actions[activeClip.current] : undefined;
    next.reset();
    next.setLoop(action === "fall" ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = action === "fall";
    next.fadeIn(0.22).play();
    previous?.fadeOut(0.22);
    activeClip.current = clipName;
  }, [action, actions]);

  useFrame((_, delta) => {
    const root = rootRef.current;
    if (!root) return;
    const previous = root.position.clone();
    root.position.lerp(target, 1 - Math.exp(-delta * 5.5));
    const direction = target.clone().sub(root.position);
    if (direction.lengthSq() > 0.0005) {
      const angle = Math.atan2(direction.x, direction.z);
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, angle, 1 - Math.exp(-delta * 8));
    }
    const speed = root.position.distanceTo(previous) / Math.max(delta, 1 / 120);
    if (speed > 0.08 && (action === "idle" || action === "walk" || action === "run" || action === "flee")) {
      const clipName = Object.keys(actions).find((name) => name.toLowerCase().endsWith(speed > 1.2 ? "run" : "walk"));
      if (clipName && activeClip.current !== clipName) {
        const next = actions[clipName];
        const previousAction = actions[activeClip.current];
        next?.reset().fadeIn(0.18).play();
        previousAction?.fadeOut(0.18);
        activeClip.current = clipName;
      }
    }
  });

  const roleColor = entity.entity_role === "suspect" ? "#f87171"
    : entity.entity_role === "victim" ? "#60a5fa"
      : entity.entity_role === "witness" ? "#34d399" : "#d4af63";

  return (
    <group ref={rootRef} position={[positions[0]?.[0] || 0, positions[0]?.[1] || 0, positions[0]?.[2] || 0]}>
      <primitive object={model} />
      <Html distanceFactor={14} position={[0, 2.08, 0]} center>
        <div className="scene-entity-label" style={{ borderColor: roleColor }}>
          <span className="scene-entity-dot" style={{ backgroundColor: roleColor }} />
          {entity.label}
        </div>
      </Html>
    </group>
  );
}

export function RealisticHuman({ entity, events, index }: { entity: SceneEntity; events: SceneEvent[]; index: number }) {
  const url = import.meta.env.DEV
    ? (index % 2 === 0 ? forensicManLocal : forensicCivilianLocal)
    : (index % 2 === 0 ? forensicManModel.url : forensicCivilianModel.url);
  return <RiggedHuman url={url} sourceScale={index % 2 === 0 ? 0.37 : 0.62} entity={entity} events={events} />;
}
