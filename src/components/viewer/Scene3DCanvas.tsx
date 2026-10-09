import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { GooglePhotorealTiles } from "./GooglePhotorealTiles";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment, Lightformer, ContactShadows, Sky, Cloud } from "@react-three/drei";
import * as THREE from "three";
import { useSceneStore } from "@/stores/sceneStore";
import type { Tables } from "@/integrations/supabase/types";
import type { RealWorldScene } from "@/lib/location-scene.functions";

type SceneEntity = Tables<"scene_entities">;
type SceneEvent = Tables<"scene_events">;

interface Scene3DCanvasProps {
  entities: SceneEntity[];
  events: SceneEvent[];
  realWorld?: RealWorldScene | null;
  debug?: boolean;
  /** Stream Google Photorealistic 3D city at the incident point (falls back to OSM build). */
  photoreal?: boolean;
  onPhotorealStatus?: (status: "loading" | "ready" | "failed", msg?: string) => void;
}

/**
 * Maps an FIR action label onto a body pose so the figure visibly performs the
 * event (attack, flee, fall, aim, grab) instead of only translating.
 */
type ActionKind = "walk" | "run" | "attack" | "fall" | "aim" | "grab" | "flee" | "idle";

function classifyAction(label: string | undefined): ActionKind {
  const t = (label || "").toLowerCase();
  if (/(fire|shoot|gun|goli|aim|pistol)/.test(t)) return "aim";
  if (/(hit|attack|stab|strike|beat|assault|hamla|maar)/.test(t)) return "attack";
  if (/(fall|collapse|injur|die|dead|gir|zakhmi)/.test(t)) return "fall";
  if (/(snatch|grab|steal|rob|loot|cheen)/.test(t)) return "grab";
  if (/(flee|escape|run away|farar|bhaag)/.test(t)) return "flee";
  if (/(run|sprint|chase)/.test(t)) return "run";
  if (/(walk|move|approach|arrive|enter|go)/.test(t)) return "walk";
  return "idle";
}

/**
 * Fully-articulated humanoid rig built from primitives — head, neck, torso,
 * hips, upper/lower arms with hands, and upper/lower legs with feet. Limbs
 * swing on a sine wave keyed to movement speed so the figure "walks" between
 * event positions instead of sliding like a capsule.
 */
function HumanFigure({ entity, events }: { entity: SceneEntity; events: SceneEvent[] }) {
  const rootRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const currentEvent = useSceneStore((s) => s.currentEvent);

  /** The action this entity is performing at the active timeline step. */
  const action = useMemo<ActionKind>(() => {
    const own = events.filter((e) => e.entity_id === entity.id);
    const active = own
      .filter((e) => (e.sequence_number ?? 0) <= currentEvent + 1)
      .sort((a, b) => (b.sequence_number ?? 0) - (a.sequence_number ?? 0))[0];
    return classifyAction(active?.action_label ?? active?.description ?? undefined);
  }, [events, entity.id, currentEvent]);

  // Compute position per event from events data
  const positions = useMemo(() => {
    if (events.length === 0) {
      return [[entity.position_x || 0, entity.position_y || 0, entity.position_z || 0]];
    }
    let pos = [entity.position_x || 0, entity.position_y || 0, entity.position_z || 0];
    const result: number[][] = [];
    for (let i = 0; i < events.length; i++) {
      const evt = events.find(e => e.sequence_number === i + 1 && e.entity_id === entity.id);
      if (evt) {
        pos = [evt.dest_x || pos[0], evt.dest_y || pos[1], evt.dest_z || pos[2]];
      }
      result.push([...pos]);
    }
    return result;
  }, [entity, events]);

  const targetPos = useMemo(() => {
    const p = positions[Math.min(currentEvent, positions.length - 1)];
    return new THREE.Vector3(p[0], p[1], p[2]);
  }, [currentEvent, positions]);

  const speedRef = useRef(0);

  useFrame((_, delta) => {
    const root = rootRef.current;
    if (!root) return;

    const prev = root.position.clone();
    const agility = action === "run" || action === "flee" ? 0.11 : action === "fall" ? 0.03 : 0.06;
    root.position.lerp(targetPos, agility);
    const moved = root.position.distanceTo(prev);
    // EMA on step speed so animation blends in/out cleanly
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, moved / Math.max(delta, 1 / 120), 0.15);

    const dir = new THREE.Vector3().subVectors(targetPos, root.position);
    if (dir.lengthSq() > 0.0004) {
      const angle = Math.atan2(dir.x, dir.z);
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, angle, 0.12);
    }

    // Walk cycle — swing arms and legs proportional to travel speed.
    const t = performance.now() / 1000;
    const fast = action === "run" || action === "flee";
    const swing = Math.min(speedRef.current * 1.6, 1) * (fast ? 1.35 : 1);
    const cycle = Math.sin(t * (fast ? 9 : 6));
    const idleBreath = Math.sin(t * 1.6) * 0.03;

    // Base locomotion
    let lLeg = cycle * 0.75 * swing;
    let rLeg = -cycle * 0.75 * swing;
    let lArm = -cycle * 0.6 * swing + idleBreath;
    let rArm = cycle * 0.6 * swing - idleBreath;
    let torsoY = 0.9 + Math.abs(cycle) * 0.04 * swing;
    let torsoPitch = fast ? 0.22 : 0.02;
    let rootTilt = 0;

    // Action overlays — these dominate the pose when an event is active.
    if (action === "attack") {
      rArm = -2.0 + Math.sin(t * 9) * 0.55; // repeated overhead strike
      lArm = 0.35;
      torsoPitch = 0.25;
    } else if (action === "aim") {
      rArm = -1.55; // arm straight forward, weapon line
      lArm = -1.35;
      torsoPitch = 0.06;
      lLeg *= 0.3;
      rLeg *= 0.3;
    } else if (action === "grab") {
      rArm = -1.2 + Math.sin(t * 5) * 0.3;
      lArm = -0.9;
      torsoPitch = 0.3;
    } else if (action === "fall") {
      rootTilt = -Math.PI / 2.1; // collapsed on the ground
      torsoY = 0.35;
      lLeg = 0.4;
      rLeg = 0.2;
      lArm = 0.9;
      rArm = 1.1;
    }

    if (leftLegRef.current) leftLegRef.current.rotation.x = lLeg;
    if (rightLegRef.current) rightLegRef.current.rotation.x = rLeg;
    if (leftArmRef.current) leftArmRef.current.rotation.x = lArm;
    if (rightArmRef.current) rightArmRef.current.rotation.x = rArm;
    if (torsoRef.current) {
      torsoRef.current.position.y = torsoY;
      torsoRef.current.rotation.x = THREE.MathUtils.lerp(torsoRef.current.rotation.x, torsoPitch, 0.15);
    }
    root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, rootTilt, 0.1);
  });

  const roleTint = entity.entity_role === "suspect" ? "#ef4444"
    : entity.entity_role === "victim" ? "#3b82f6"
    : entity.entity_role === "witness" ? "#22c55e"
    : entity.color || "#C9A84C";

  const skin = "#d9b48a";
  const pants = "#1e293b";
  const hair = "#181410";

  return (
    <group ref={rootRef} position={[positions[0][0], 0, positions[0][2]]}>
      {/* Hip pivot */}
      <group ref={torsoRef} position={[0, 0.9, 0]}>
        {/* Torso / shirt */}
        <mesh castShadow position={[0, 0.05, 0]}>
          <capsuleGeometry args={[0.16, 0.45, 8, 16]} />
          <meshStandardMaterial color={roleTint} roughness={0.6} metalness={0.05} />
        </mesh>
        {/* Neck */}
        <mesh castShadow position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.055, 0.065, 0.09, 12]} />
          <meshStandardMaterial color={skin} roughness={0.75} />
        </mesh>
        {/* Head */}
        <mesh castShadow position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshStandardMaterial color={skin} roughness={0.72} />
        </mesh>
        {/* Hair cap */}
        <mesh castShadow position={[0, 0.63, -0.01]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.135, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={hair} roughness={0.9} />
        </mesh>
        {/* Eyes */}
        <mesh position={[0.045, 0.56, 0.115]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#0b0b0b" />
        </mesh>
        <mesh position={[-0.045, 0.56, 0.115]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color="#0b0b0b" />
        </mesh>

        {/* Left arm */}
        <group ref={leftArmRef} position={[0.22, 0.28, 0]}>
          <mesh castShadow position={[0, -0.18, 0]}>
            <capsuleGeometry args={[0.055, 0.28, 6, 12]} />
            <meshStandardMaterial color={roleTint} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, -0.42, 0]}>
            <capsuleGeometry args={[0.05, 0.22, 6, 12]} />
            <meshStandardMaterial color={skin} roughness={0.75} />
          </mesh>
        </group>
        {/* Right arm */}
        <group ref={rightArmRef} position={[-0.22, 0.28, 0]}>
          <mesh castShadow position={[0, -0.18, 0]}>
            <capsuleGeometry args={[0.055, 0.28, 6, 12]} />
            <meshStandardMaterial color={roleTint} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, -0.42, 0]}>
            <capsuleGeometry args={[0.05, 0.22, 6, 12]} />
            <meshStandardMaterial color={skin} roughness={0.75} />
          </mesh>
        </group>
      </group>

      {/* Left leg */}
      <group ref={leftLegRef} position={[0.09, 0.85, 0]}>
        <mesh castShadow position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.07, 0.44, 6, 12]} />
          <meshStandardMaterial color={pants} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, -0.6, 0.06]}>
          <boxGeometry args={[0.14, 0.06, 0.22]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
      </group>
      {/* Right leg */}
      <group ref={rightLegRef} position={[-0.09, 0.85, 0]}>
        <mesh castShadow position={[0, -0.24, 0]}>
          <capsuleGeometry args={[0.07, 0.44, 6, 12]} />
          <meshStandardMaterial color={pants} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, -0.6, 0.06]}>
          <boxGeometry args={[0.14, 0.06, 0.22]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
      </group>

      <Html distanceFactor={12} position={[0, 2.05, 0]} center>
        <div className="rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
             style={{ color: roleTint, borderColor: roleTint, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          {entity.label}
        </div>
      </Html>
    </group>
  );
}

function VehicleFigure({ entity, events }: { entity: SceneEntity; events: SceneEvent[] }) {
  const rootRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<Array<THREE.Mesh | null>>([]);
  const brakeRef = useRef<THREE.MeshStandardMaterial>(null);
  const currentEvent = useSceneStore((s) => s.currentEvent);

  const positions = useMemo(() => {
    if (events.length === 0) return [[entity.position_x || 0, 0, entity.position_z || 0]];
    let pos = [entity.position_x || 0, 0, entity.position_z || 0];
    const result: number[][] = [];
    for (let i = 0; i < events.length; i++) {
      const evt = events.find((e) => e.sequence_number === i + 1 && e.entity_id === entity.id);
      if (evt) pos = [evt.dest_x || pos[0], 0, evt.dest_z || pos[2]];
      result.push([...pos]);
    }
    return result;
  }, [entity, events]);

  const targetPos = useMemo(() => {
    const p = positions[Math.min(currentEvent, positions.length - 1)];
    return new THREE.Vector3(p[0], 0, p[2]);
  }, [currentEvent, positions]);

  const speedRef = useRef(0);

  useFrame((_, delta) => {
    const root = rootRef.current;
    if (!root) return;
    const prev = root.position.clone();
    root.position.lerp(targetPos, 0.055);
    const dir = new THREE.Vector3().subVectors(root.position, prev);
    const moved = dir.length();
    if (dir.lengthSq() > 0.00005) root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, Math.atan2(dir.x, dir.z), 0.12);

    const speed = moved / Math.max(delta, 1 / 120);
    const decelerating = speed < speedRef.current - 0.05;
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, speed, 0.2);

    // Wheels spin with real travel distance; body leans under accel/brake.
    for (const w of wheelRefs.current) {
      if (w) w.rotation.x += moved / 0.23;
    }
    root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, decelerating ? 0.03 : -0.02 * Math.min(speed, 1), 0.1);
    if (brakeRef.current) {
      brakeRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        brakeRef.current.emissiveIntensity,
        decelerating || speedRef.current < 0.05 ? 2.6 : 0.35,
        0.2,
      );
    }
  });

  const color = entity.color || "#C9A84C";
  return (
    <group ref={rootRef} position={[positions[0][0], 0, positions[0][2]]}>
      <mesh castShadow receiveShadow position={[0, 0.36, 0]}>
        <boxGeometry args={[2.35, 0.55, 1.12]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[-0.12, 0.82, -0.02]}>
        <boxGeometry args={[1.22, 0.5, 1.02]} />
        <meshStandardMaterial color={color} metalness={0.48} roughness={0.3} />
      </mesh>
      <mesh position={[-0.1, 0.84, 0.502]}>
        <planeGeometry args={[1.0, 0.32]} />
        <meshStandardMaterial color="#07111f" metalness={0.9} roughness={0.12} />
      </mesh>
      <mesh position={[-0.1, 0.84, -0.502]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.0, 0.32]} />
        <meshStandardMaterial color="#07111f" metalness={0.9} roughness={0.12} />
      </mesh>
      {([[-0.78, 0.2, 0.54], [0.78, 0.2, 0.54], [-0.78, 0.2, -0.54], [0.78, 0.2, -0.54]] as [number, number, number][]).map((w, i) => (
        <mesh
          key={i}
          ref={(m) => { wheelRefs.current[i] = m; }}
          position={w}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.23, 0.23, 0.18, 20]} />
          <meshStandardMaterial color="#080808" roughness={0.86} />
        </mesh>
      ))}
      {/* Brake bar — lights up when the vehicle decelerates or stops */}
      <mesh position={[-1.18, 0.5, 0]}>
        <boxGeometry args={[0.05, 0.09, 0.8]} />
        <meshStandardMaterial ref={brakeRef} color="#5c0b0b" emissive="#ff2020" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[1.2, 0.38, 0.33]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#fff8d0" emissive="#fff2a8" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[1.2, 0.38, -0.33]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#fff8d0" emissive="#fff2a8" emissiveIntensity={1.4} />
      </mesh>
      <Html distanceFactor={12} position={[0, 1.65, 0]} center>
        <div className="rounded-full border border-gold/50 bg-background/75 px-2 py-0.5 text-[10px] font-semibold text-gold backdrop-blur-sm whitespace-nowrap">
          {entity.label}
        </div>
      </Html>
    </group>
  );
}

function LocationBeacon({ entity }: { entity: SceneEntity }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.15;
      ringRef.current.scale.set(s, s, s);
    }
  });

  const pos: [number, number, number] = [entity.position_x || 0, 0, entity.position_z || 0];

  return (
    <group position={pos}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[0.35, 0.45, 32]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.7} />
      </mesh>
      {/* Vertical marker post so the beacon is visible above props */}
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.4, 8]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.5} />
      </mesh>
      <Html distanceFactor={15} position={[0, 2.6, 0]} center>
        <div className="rounded-[2px] bg-gold/10 px-2 py-0.5 text-[9px] font-semibold text-gold backdrop-blur-sm whitespace-nowrap border border-gold/20">
          {entity.label}
        </div>
      </Html>
    </group>
  );
}

/** Projected metre polygon → THREE.Shape usable as a flat ground patch. */
function polygonToShape(polygon: Array<[number, number]>) {
  const shape = new THREE.Shape();
  polygon.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  return shape;
}

function landuseColor(kind: string) {
  if (/park|grass|forest|meadow|recreation|pitch/.test(kind)) return "#3f6f3c";
  if (/farm|orchard|allotment/.test(kind)) return "#7d7a3c";
  if (/parking/.test(kind)) return "#3a3d42";
  if (/industrial/.test(kind)) return "#5a5750";
  if (/commercial|retail/.test(kind)) return "#6a6459";
  if (/residential/.test(kind)) return "#5d5c52";
  return "#4e6247";
}

/**
 * Real-world environment rebuilt from the FIR anchor. It merges OSM footprints,
 * Google roads/places, and coordinate-anchored inferred structures when public
 * map providers do not expose enough detail for that exact location.
 */
function RealWorldEnvironment({ scene }: { scene: RealWorldScene }) {
  const buildings = useMemo(() => {
    return scene.buildings.map((b, i) => {
      const shape = new THREE.Shape();
      b.footprint.forEach(([x, z], idx) => {
        if (idx === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      });
      const geom = new THREE.ExtrudeGeometry(shape, {
        depth: b.height,
        bevelEnabled: false,
        curveSegments: 1,
      });
      // Extrude is on +Z of shape plane → rotate so height points up (+Y)
      geom.rotateX(-Math.PI / 2);
      // Prefer the real OSM building:colour/material tag; otherwise shade by height.
      const t = Math.min(1, b.height / 30);
      const color = b.color
        ? new THREE.Color(b.color)
        : new THREE.Color().lerpColors(new THREE.Color("#c8b28d"), new THREE.Color("#6b7f96"), t);
      return { i, geom, color, height: b.height };
    });
  }, [scene.buildings]);

  // Cleanup extrude geometries on unmount
  useEffect(() => {
    return () => {
      buildings.forEach((b) => b.geom.dispose());
    };
  }, [buildings]);

  const roadSegments = useMemo(() => {
    // Sort so wider (bigger) roads render first (below narrower footpaths)
    const sorted = [...scene.roads].sort((a, b) => b.width - a.width);
    const segments: {
      x: number;
      z: number;
      length: number;
      angle: number;
      width: number;
      color: string;
      lanes?: number;
    }[] = [];
    for (const r of sorted) {
      const color = r.width >= 6 ? "#20242b" : r.width >= 3 ? "#2a2f37" : "#8a8578";
      const paved = !r.surface || /asphalt|paved|concrete/.test(r.surface);
      const surfaceColor = paved ? color : "#6b5a42";
      for (let i = 0; i < r.path.length - 1; i++) {
        const [x1, z1] = r.path[i];
        const [x2, z2] = r.path[i + 1];
        const dx = x2 - x1;
        const dz = z2 - z1;
        const length = Math.hypot(dx, dz);
        if (length < 0.5) continue;
        segments.push({
          x: (x1 + x2) / 2,
          z: (z1 + z2) / 2,
          length,
          angle: Math.atan2(dz, dx),
          width: r.width,
          color: surfaceColor,
          lanes: r.lanes ?? (r.width >= 6 ? 2 : 1),
        });
      }
    }
    return segments;
  }, [scene.roads]);

  return (
    <group>
      {/* Real-location ground canvas. Even when map providers lack footprints, this stays anchored to the FIR lat/lng. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[scene.radiusMeters * 4, scene.radiusMeters * 4]} />
        <meshStandardMaterial color="#496242" roughness={1} />
      </mesh>

      {/* Land-use patches (parks, farmland, parking lots) under the roads */}
      {(scene.landuse ?? []).map((a, i) => (
        <mesh key={`lu-${i}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <shapeGeometry args={[polygonToShape(a.polygon)]} />
          <meshStandardMaterial color={landuseColor(a.kind)} roughness={1} />
        </mesh>
      ))}

      {/* Water bodies from OSM */}
      {(scene.water ?? []).map((w, i) => (
        <mesh key={`wa-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <shapeGeometry args={[polygonToShape(w.polygon)]} />
          <meshStandardMaterial color="#2f6d8f" roughness={0.15} metalness={0.35} />
        </mesh>
      ))}

      {/* Roads with sidewalks and lane markings */}
      {roadSegments.map((s, i) => (
        <group key={`rd-${i}`} rotation={[0, -s.angle, 0]} position={[s.x, 0, s.z]}>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[s.length, s.width]} />
            <meshStandardMaterial color={s.color} roughness={0.95} />
          </mesh>
          {s.width >= 4 && (
            <>
              <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, s.width / 2 + 0.7]}>
                <planeGeometry args={[s.length, 1.4]} />
                <meshStandardMaterial color="#8d8b84" roughness={1} />
              </mesh>
              <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -s.width / 2 - 0.7]}>
                <planeGeometry args={[s.length, 1.4]} />
                <meshStandardMaterial color="#8d8b84" roughness={1} />
              </mesh>
            </>
          )}
          {(s.lanes ?? 1) >= 2 && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <planeGeometry args={[s.length * 0.72, 0.16]} />
              <meshStandardMaterial color="#e8e2c8" roughness={0.7} />
            </mesh>
          )}
        </group>
      ))}

      {/* Walls / fences */}
      {(scene.barriers ?? []).flatMap((b, bi) =>
        b.path.slice(0, -1).map(([x1, z1], i) => {
          const [x2, z2] = b.path[i + 1];
          const len = Math.hypot(x2 - x1, z2 - z1);
          if (len < 0.6) return null;
          return (
            <mesh
              key={`bar-${bi}-${i}`}
              castShadow
              position={[(x1 + x2) / 2, b.height / 2, (z1 + z2) / 2]}
              rotation={[0, -Math.atan2(z2 - z1, x2 - x1), 0]}
            >
              <boxGeometry args={[len, b.height, 0.22]} />
              <meshStandardMaterial color={b.kind === "hedge" ? "#3d6b3c" : "#a49b8b"} roughness={0.95} />
            </mesh>
          );
        }),
      )}

      {/* Zebra crossings */}
      {(scene.crossings ?? []).map(([x, z], i) => (
        <group key={`cr-${i}`} position={[x, 0.035, z]}>
          {[-1.5, -0.75, 0, 0.75, 1.5].map((o) => (
            <mesh key={o} rotation={[-Math.PI / 2, 0, 0]} position={[o, 0, 0]}>
              <planeGeometry args={[0.4, 3.2]} />
              <meshStandardMaterial color="#efeade" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Extruded building footprints */}
      {buildings.map((b) => (
        <mesh key={`bl-${b.i}`} castShadow receiveShadow geometry={b.geom}>
          <meshStandardMaterial color={b.color} roughness={0.78} />
        </mesh>
      ))}

      {/* Trees from OSM nodes */}
      {scene.trees.map(([x, z], i) => (
        <group key={`t-${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.09, 0.14, 1.4, 8]} />
            <meshStandardMaterial color="#5b3a20" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.9, 0]}>
            <icosahedronGeometry args={[0.85, 1]} />
            <meshStandardMaterial color="#2f6a3a" roughness={0.85} flatShading />
          </mesh>
        </group>
      ))}

      {/* Street lights from OSM or location-anchored inference */}
      {scene.streetLights.map(([x, z], i) => (
        <group key={`lamp-${i}`} position={[x, 0, z]}>
          <mesh castShadow position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.035, 0.045, 3.2, 8]} />
            <meshStandardMaterial color="#111827" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0.42, 3.12, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color="#fff2b3" emissive="#ffcf6a" emissiveIntensity={1.5} />
          </mesh>
          <pointLight position={[0.42, 3.12, 0]} intensity={0.45} distance={8} color="#ffcf6a" />
        </group>
      ))}

      {/* Named real places from Google/OSM */}
      {scene.landmarks.slice(0, 18).map((p, i) => (
        <group key={`poi-${i}`} position={[p.position[0], 0, p.position[1]]}>
          <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.75, 0.95, 28]} />
            <meshBasicMaterial color={p.source === "google" ? "#38bdf8" : "#C9A84C"} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <Html distanceFactor={22} position={[0, 1.35, 0]} center>
            <div className="max-w-[140px] rounded-[3px] border border-border-subtle bg-background/75 px-2 py-1 text-center text-[9px] font-semibold text-text-secondary shadow-md backdrop-blur-sm">
              {p.label}
            </div>
          </Html>
        </group>
      ))}

      {/* Incident anchor marker */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.7, 40]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function RealLocationShell() {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[520, 520]} />
        <meshStandardMaterial color="#496242" roughness={1} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.8, 40]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function MovementTrails({ entities, events }: { entities: SceneEntity[]; events: SceneEvent[] }) {
  const currentEvent = useSceneStore((s) => s.currentEvent);
  const actorEntities = entities.filter(e => e.entity_type === "actor");

  return (
    <group>
      {actorEntities.map((entity) => {
        const points: THREE.Vector3[] = [];
        let pos = [entity.position_x || 0, 0.05, entity.position_z || 0];
        points.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
        for (let i = 0; i < Math.min(currentEvent + 1, events.length); i++) {
          const evt = events[i];
          if (evt.entity_id === entity.id) {
            points.push(new THREE.Vector3(evt.dest_x || pos[0], 0.05, evt.dest_z || pos[2]));
            pos = [evt.dest_x || pos[0], 0.05, evt.dest_z || pos[2]];
          }
        }
        if (points.length < 2) return null;
        const curve = new THREE.CatmullRomCurve3(points);
        return (
          <mesh key={entity.id}>
            <tubeGeometry args={[curve, 20, 0.02, 8, false]} />
            <meshBasicMaterial color={entity.color || "#C9A84C"} transparent opacity={0.4} />
          </mesh>
        );
      })}
    </group>
  );
}

function ZoomBridge() {
  const { camera } = useThree();
  useEffect(() => {
    const onZoom = (e: Event) => {
      const dir = (e as CustomEvent).detail as "in" | "out";
      const factor = dir === "in" ? 0.85 : 1.18;
      camera.position.multiplyScalar(factor);
      const dist = camera.position.length();
      if (dist < 4) camera.position.setLength(4);
      if (dist > 60) camera.position.setLength(60);
    };
    window.addEventListener("sceneiq:zoom", onZoom);
    return () => window.removeEventListener("sceneiq:zoom", onZoom);
  }, [camera]);
  return null;
}

function CinematicCameraBridge({ entities, events }: { entities: SceneEntity[]; events: SceneEvent[] }) {
  const { camera } = useThree();
  const currentEvent = useSceneStore((s) => s.currentEvent);
  const playing = useSceneStore((s) => s.playing);
  useFrame(({ clock }) => {
    if (!playing && events.length === 0) return;
    const evt = events[Math.min(currentEvent, Math.max(0, events.length - 1))];
    const entity = evt?.entity_id ? entities.find((e) => e.id === evt.entity_id) : entities[0];
    const tx = evt?.dest_x ?? entity?.position_x ?? 0;
    const tz = evt?.dest_z ?? entity?.position_z ?? 0;
    const t = clock.getElapsedTime() * 0.22;
    const target = new THREE.Vector3(tx, 0.8, tz);
    const desired = new THREE.Vector3(tx + Math.cos(t) * 18, 9 + Math.sin(t * 0.7) * 1.2, tz + Math.sin(t) * 18);
    camera.position.lerp(desired, 0.012);
    camera.lookAt(target);
  });
  return null;
}

/**
 * Draws a wireframe bounding box + label over every vehicle so a missing car
 * can be traced to its exact coordinates instead of guessing.
 */
function VehicleDebugBounds({ entities }: { entities: SceneEntity[] }) {
  const vehicles = entities.filter((e) => e.entity_type === "vehicle");
  useEffect(() => {
    if (vehicles.length === 0) {
      console.warn("[SceneIQ:debug] no vehicle entities reached the renderer");
      return;
    }
    for (const v of vehicles) {
      console.info("[SceneIQ:debug] vehicle", {
        id: v.id,
        label: v.label,
        pos: [v.position_x ?? 0, v.position_y ?? 0, v.position_z ?? 0],
        inferred: Boolean((v.metadata as { inferred?: boolean } | null)?.inferred),
      });
    }
  }, [vehicles.length, vehicles]);

  return (
    <>
      {vehicles.map((v) => (
        <group key={`dbg-${v.id}`} position={[v.position_x ?? 0, (v.position_y ?? 0) + 0.9, v.position_z ?? 0]}>
          <mesh>
            <boxGeometry args={[4.4, 1.9, 2.2]} />
            <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.9} />
          </mesh>
          <Html center distanceFactor={16} position={[0, 1.6, 0]}>
            <div style={{ background: "rgba(0,0,0,0.75)", color: "#22c55e", padding: "2px 6px", borderRadius: 4, fontSize: 10, whiteSpace: "nowrap" }}>
              {v.label} · {(v.position_x ?? 0).toFixed(1)},{(v.position_z ?? 0).toFixed(1)}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

export function Scene3DCanvas({ entities, events, realWorld, debug = false, photoreal = true, onPhotorealStatus }: Scene3DCanvasProps) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const useTiles = photoreal && !!realWorld?.anchor && !tilesFailed;
  useEffect(() => {
    setTilesFailed(false);
  }, [realWorld?.anchor?.lat, realWorld?.anchor?.lng]);
  useEffect(() => {
    if (useTiles) onPhotorealStatus?.("loading");
  }, [useTiles, onPhotorealStatus]);
  const handleTilesError = useCallback((msg: string) => {
    console.warn("Google 3D tiles:", msg);
    setTilesFailed(true);
    onPhotorealStatus?.("failed", msg);
  }, [onPhotorealStatus]);
  const handleTilesReady = useCallback(() => onPhotorealStatus?.("ready"), [onPhotorealStatus]);
  const actorEntities = entities.filter(e => e.entity_type === "actor");
  const vehicleEntities = entities.filter(e => e.entity_type === "vehicle");
  const locationEntities = entities.filter(e => e.entity_type === "location");

  return (
    <Canvas
      shadows
      dpr={[1.25, 2]}
      camera={{ position: [14, 9, 16], fov: 45, near: 0.1, far: 4000 }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#8fbfe0"]} />
      <Sky sunPosition={[80, 40, 30]} turbidity={6} rayleigh={2} mieCoefficient={0.005} mieDirectionalG={0.8} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#cfe6ff", "#4a3d2a", 0.55]} />
      <directionalLight
        castShadow
        position={[30, 40, 20]}
        intensity={1.4}
        color="#fff1d4"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      {/* Local IBL — a CDN preset fetch can hang the whole scene blank. */}
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        <Lightformer intensity={1.2} color="#ffd9a8" position={[-12, 4, -6]} rotation-y={Math.PI / 2} scale={[24, 3, 1]} />
        <Lightformer intensity={0.9} color="#bcd8ff" position={[12, 3, 8]} rotation-y={-Math.PI / 2} scale={[24, 3, 1]} />
      </Environment>
      <Cloud position={[-20, 22, -15]} speed={0.15} opacity={0.55} />
      <Cloud position={[18, 26, 10]} speed={0.1} opacity={0.4} />

      {useTiles && realWorld ? (
        <GooglePhotorealTiles
          lat={realWorld.anchor.lat}
          lng={realWorld.anchor.lng}
          onError={handleTilesError}
          onReady={handleTilesReady}
        />
      ) : realWorld ? (
        <RealWorldEnvironment scene={realWorld} />
      ) : (
        <RealLocationShell />
      )}

      <ContactShadows position={[0, 0.08, 0]} opacity={0.45} scale={60} blur={2.8} far={12} />

      {actorEntities.map((e) => (
        <HumanFigure key={e.id} entity={e} events={events} />
      ))}

      {vehicleEntities.map((e) => (
        <VehicleFigure key={e.id} entity={e} events={events} />
      ))}

      {locationEntities.map((l) => (
        <LocationBeacon key={l.id} entity={l} />
      ))}

      <MovementTrails entities={entities} events={events} />

      {debug && <VehicleDebugBounds entities={entities} />}
      {debug && <axesHelper args={[10]} />}

      <ZoomBridge />
      <CinematicCameraBridge entities={entities} events={events} />
      <RecorderBridge />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={5}
        maxDistance={useTiles ? 400 : 80}
        maxPolarAngle={Math.PI / 2.2}
      />

      <fog attach="fog" args={["#b8d2e6", useTiles ? 300 : 55, useTiles ? 1500 : 140]} />
    </Canvas>
  );
}

/**
 * Records the WebGL canvas via MediaRecorder when it receives
 * `sceneiq:record-start { durationSec }` and emits `sceneiq:record-blob { blob, mime }`
 * when done. Uses `preserveDrawingBuffer: true` on the Canvas so
 * captureStream() produces valid frames.
 */
function RecorderBridge() {
  const { gl } = useThree();
  useEffect(() => {
    const onStart = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { durationSec: number };
      const canvas = gl.domElement as HTMLCanvasElement;
      const stream = canvas.captureStream(60);
      // Prefer high-quality H.264 MP4 (Safari-native) → VP9 → VP8 → generic WebM.
      const candidates = [
        "video/mp4;codecs=avc1.640028", // H.264 High @ Level 4.0
        "video/mp4;codecs=avc1.42E01E", // H.264 Baseline
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const MR = (window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder;
      const mime = candidates.find((c) => MR.isTypeSupported(c)) || "video/webm";
      // 10 Mbps for crisp 1080p-ish canvas capture with role-tinted geometry.
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        window.dispatchEvent(new CustomEvent("sceneiq:record-blob", { detail: { blob, mime } }));
      };
      rec.start(100);
      setTimeout(() => rec.stop(), Math.max(2000, detail.durationSec * 1000));
    };
    window.addEventListener("sceneiq:record-start", onStart);
    return () => window.removeEventListener("sceneiq:record-start", onStart);
  }, [gl]);
  return null;
}
