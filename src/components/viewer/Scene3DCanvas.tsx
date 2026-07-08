import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Environment, ContactShadows, Sky, Cloud } from "@react-three/drei";
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
}

// Deterministic PRNG so procedural props stay stable between frames/renders.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    root.position.lerp(targetPos, 0.06);
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
    const swing = Math.min(speedRef.current * 1.6, 1);
    const cycle = Math.sin(t * 6);
    if (leftLegRef.current) leftLegRef.current.rotation.x = cycle * 0.75 * swing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -cycle * 0.75 * swing;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -cycle * 0.6 * swing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = cycle * 0.6 * swing;
    if (torsoRef.current) torsoRef.current.position.y = 0.9 + Math.abs(cycle) * 0.04 * swing;
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

/**
 * Procedural city block — asphalt roads with lane markings, sidewalks with
 * curbs, varied buildings with lit windows, trees, streetlights, benches,
 * and parked cars. Seeded so the layout is stable frame-to-frame.
 */
function CityEnvironment() {
  const rng = useMemo(() => mulberry32(1337), []);
  const buildings = useMemo(() => {
    const items: {
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
      windows: { rows: number; cols: number; lit: boolean[] };
    }[] = [];
    const palette = ["#8a99ab", "#c8b28d", "#a8836a", "#6b7f96", "#b8a17e", "#7a8a9a"];
    // Two rows of buildings flanking the main road (Z axis)
    for (let side = -1; side <= 1; side += 2) {
      for (let i = -3; i <= 3; i++) {
        const w = 3 + rng() * 1.5;
        const d = 3 + rng() * 1.5;
        const h = 4 + rng() * 8;
        const z = i * 5 + (rng() - 0.5) * 0.5;
        const x = side * (8 + rng() * 1.5);
        const rows = Math.max(2, Math.floor(h / 1.1));
        const cols = Math.max(2, Math.floor(w / 0.8));
        const lit: boolean[] = [];
        for (let k = 0; k < rows * cols; k++) lit.push(rng() > 0.45);
        items.push({
          pos: [x, h / 2, z],
          size: [w, h, d],
          color: palette[Math.floor(rng() * palette.length)],
          windows: { rows, cols, lit },
        });
      }
    }
    return items;
  }, [rng]);

  const trees = useMemo(() => {
    const items: { pos: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (4.2 + rng() * 0.6);
      const z = -18 + i * 1.5 + (rng() - 0.5) * 0.4;
      items.push({ pos: [x, 0, z], scale: 0.85 + rng() * 0.5 });
    }
    return items;
  }, [rng]);

  const streetlights = useMemo(() => {
    const items: [number, number, number][] = [];
    for (let i = -4; i <= 4; i++) {
      items.push([-4.5, 0, i * 4]);
      items.push([4.5, 0, i * 4]);
    }
    return items;
  }, []);

  const cars = useMemo(() => {
    const items: { pos: [number, number, number]; rot: number; color: string }[] = [];
    const colors = ["#c53030", "#1f2937", "#f5f5f4", "#0ea5e9", "#facc15"];
    for (let i = 0; i < 5; i++) {
      items.push({
        pos: [(i % 2 === 0 ? -1 : 1) * (5.8 + rng() * 0.2), 0, -12 + i * 5 + rng()],
        rot: i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
    return items;
  }, [rng]);

  return (
    <group>
      {/* Ground (grass fields far out) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#3f5b3a" roughness={1} />
      </mesh>
      {/* Main asphalt road (Z-axis) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[6, 200]} />
        <meshStandardMaterial color="#1a1d22" roughness={0.95} />
      </mesh>
      {/* Cross road (X-axis) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
        <planeGeometry args={[200, 6]} />
        <meshStandardMaterial color="#1a1d22" roughness={0.95} />
      </mesh>
      {/* Center dashed lane markings */}
      {Array.from({ length: 40 }).map((_, i) => (
        <mesh key={`ln-z-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -40 + i * 2]}>
          <planeGeometry args={[0.12, 0.8]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}
      {Array.from({ length: 40 }).map((_, i) => (
        <mesh key={`ln-x-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-40 + i * 2, 0.021, 0]}>
          <planeGeometry args={[0.8, 0.12]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}
      {/* Sidewalks */}
      {[-1, 1].map((s) => (
        <mesh key={`sw-z-${s}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[s * 4, 0.05, 0]}>
          <planeGeometry args={[2, 200]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`sw-x-${s}`} receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, s * 4]}>
          <planeGeometry args={[200, 2]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.9} />
        </mesh>
      ))}
      {/* Curbs */}
      {[-1, 1].map((s) => (
        <mesh key={`curb-z-${s}`} castShadow receiveShadow position={[s * 3.05, 0.075, 0]}>
          <boxGeometry args={[0.1, 0.15, 200]} />
          <meshStandardMaterial color="#6b7280" roughness={0.9} />
        </mesh>
      ))}

      {/* Buildings with window rows */}
      {buildings.map((b, i) => (
        <group key={`bld-${i}`} position={b.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.color} roughness={0.75} />
          </mesh>
          {/* Windows — front facade */}
          {Array.from({ length: b.windows.rows }).map((_, row) =>
            Array.from({ length: b.windows.cols }).map((_, col) => {
              const wx = -b.size[0] / 2 + 0.4 + col * ((b.size[0] - 0.8) / Math.max(1, b.windows.cols - 1));
              const wy = -b.size[1] / 2 + 0.9 + row * 1.1;
              const lit = b.windows.lit[row * b.windows.cols + col];
              return (
                <mesh key={`w-${row}-${col}`} position={[wx, wy, b.size[2] / 2 + 0.01]}>
                  <planeGeometry args={[0.35, 0.55]} />
                  <meshStandardMaterial
                    color={lit ? "#ffe27a" : "#0f172a"}
                    emissive={lit ? "#ffb84a" : "#000000"}
                    emissiveIntensity={lit ? 0.7 : 0}
                  />
                </mesh>
              );
            }),
          )}
          {/* Roof cap */}
          <mesh castShadow position={[0, b.size[1] / 2 + 0.05, 0]}>
            <boxGeometry args={[b.size[0] + 0.2, 0.1, b.size[2] + 0.2]} />
            <meshStandardMaterial color="#3b3b3b" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Trees — trunk + layered foliage */}
      {trees.map((t, i) => (
        <group key={`tree-${i}`} position={t.pos} scale={t.scale}>
          <mesh castShadow position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.09, 0.13, 1.2, 8]} />
            <meshStandardMaterial color="#5b3a20" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0, 1.5, 0]}>
            <icosahedronGeometry args={[0.75, 1]} />
            <meshStandardMaterial color="#2f6a3a" roughness={0.85} flatShading />
          </mesh>
          <mesh castShadow position={[0.25, 1.85, 0.15]}>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial color="#3a7f45" roughness={0.85} flatShading />
          </mesh>
          <mesh castShadow position={[-0.2, 1.75, -0.15]}>
            <icosahedronGeometry args={[0.55, 1]} />
            <meshStandardMaterial color="#276b34" roughness={0.85} flatShading />
          </mesh>
        </group>
      ))}

      {/* Streetlights */}
      {streetlights.map((p, i) => (
        <group key={`sl-${i}`} position={p}>
          <mesh castShadow position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 3.2, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0.3, 3.15, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0.6, 3.05, 0]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color="#fff2b3" emissive="#ffcf6a" emissiveIntensity={1.6} />
          </mesh>
          <pointLight position={[0.6, 3.05, 0]} intensity={0.6} distance={7} color="#ffcf6a" />
        </group>
      ))}

      {/* Parked cars */}
      {cars.map((c, i) => (
        <group key={`car-${i}`} position={c.pos} rotation={[0, c.rot, 0]}>
          <mesh castShadow position={[0, 0.35, 0]}>
            <boxGeometry args={[1.8, 0.5, 0.9]} />
            <meshStandardMaterial color={c.color} metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh castShadow position={[0.05, 0.75, 0]}>
            <boxGeometry args={[1.0, 0.4, 0.85]} />
            <meshStandardMaterial color={c.color} metalness={0.55} roughness={0.35} />
          </mesh>
          {/* Windows */}
          <mesh position={[0.05, 0.76, 0.431]}>
            <planeGeometry args={[0.9, 0.32]} />
            <meshStandardMaterial color="#0b1220" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Wheels */}
          {[[-0.6, 0.18, 0.42], [0.6, 0.18, 0.42], [-0.6, 0.18, -0.42], [0.6, 0.18, -0.42]].map((w, j) => (
            <mesh key={j} position={w as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 0.15, 16]} />
              <meshStandardMaterial color="#111" roughness={0.9} />
            </mesh>
          ))}
          {/* Headlights */}
          <mesh position={[0.92, 0.35, 0.25]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#fff8d0" emissive="#fff2a8" emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[0.92, 0.35, -0.25]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#fff8d0" emissive="#fff2a8" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
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

/**
 * Real-world environment rebuilt from OpenStreetMap footprints around the
 * FIR anchor. Buildings are extruded polygons, roads are ribbon meshes,
 * trees are billboarded low-poly clusters. Falls back to nothing if arrays
 * are empty (caller then keeps procedural CityEnvironment).
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
      // Colour by height so the skyline reads well
      const t = Math.min(1, b.height / 30);
      const color = new THREE.Color().lerpColors(
        new THREE.Color("#c8b28d"),
        new THREE.Color("#6b7f96"),
        t,
      );
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
    }[] = [];
    for (const r of sorted) {
      const color = r.width >= 6 ? "#20242b" : r.width >= 3 ? "#2a2f37" : "#8a8578";
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
          color,
        });
      }
    }
    return segments;
  }, [scene.roads]);

  return (
    <group>
      {/* Grass ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[scene.radiusMeters * 4, scene.radiusMeters * 4]} />
        <meshStandardMaterial color="#3d5a34" roughness={1} />
      </mesh>

      {/* Roads */}
      {roadSegments.map((s, i) => (
        <mesh
          key={`rd-${i}`}
          receiveShadow
          rotation={[-Math.PI / 2, 0, -s.angle]}
          position={[s.x, 0.01, s.z]}
        >
          <planeGeometry args={[s.length, s.width]} />
          <meshStandardMaterial color={s.color} roughness={0.95} />
        </mesh>
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

      {/* Incident anchor marker */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.7, 40]} />
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

export function Scene3DCanvas({ entities, events, realWorld }: Scene3DCanvasProps) {
  const actorEntities = entities.filter(e => e.entity_type === "actor" || e.entity_type === "vehicle");
  const locationEntities = entities.filter(e => e.entity_type === "location");
  const useReal = !!(realWorld && (realWorld.buildings.length > 0 || realWorld.roads.length > 0));

  return (
    <Canvas
      shadows
      dpr={[1.25, 2]}
      camera={{ position: [14, 9, 16], fov: 45, near: 0.1, far: 400 }}
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
      <Environment preset="sunset" />
      <Cloud position={[-20, 22, -15]} speed={0.15} opacity={0.55} />
      <Cloud position={[18, 26, 10]} speed={0.1} opacity={0.4} />

      {useReal ? <RealWorldEnvironment scene={realWorld!} /> : <CityEnvironment />}

      <ContactShadows position={[0, 0.08, 0]} opacity={0.45} scale={60} blur={2.8} far={12} />

      {actorEntities.map((e) => (
        <HumanFigure key={e.id} entity={e} events={events} />
      ))}

      {locationEntities.map((l) => (
        <LocationBeacon key={l.id} entity={l} />
      ))}

      <MovementTrails entities={entities} events={events} />

      <ZoomBridge />
      <RecorderBridge />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={5}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.2}
      />

      <fog attach="fog" args={["#b8d2e6", 55, 140]} />
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
