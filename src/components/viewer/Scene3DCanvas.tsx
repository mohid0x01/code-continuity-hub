import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import * as THREE from "three";
import { useSceneStore } from "@/stores/sceneStore";
import type { Tables } from "@/integrations/supabase/types";

type SceneEntity = Tables<"scene_entities">;
type SceneEvent = Tables<"scene_events">;

interface Scene3DCanvasProps {
  entities: SceneEntity[];
  events: SceneEvent[];
}

function EntityFigure({ entity, events }: { entity: SceneEntity; events: SceneEvent[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
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
    return new THREE.Vector3(p[0], p[1] + 0.75, p[2]);
  }, [currentEvent, positions]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.lerp(targetPos, 0.08);
    }
  });

  const color = entity.color || "#C9A84C";

  return (
    <group>
      <mesh ref={meshRef} position={[positions[0][0], positions[0][1] + 0.75, positions[0][2]]}>
        <capsuleGeometry args={[0.25, 0.8, 8, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.85} />
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.85} />
        </mesh>
        <Html distanceFactor={12} position={[0, 1.2, 0]} center>
          <div className="rounded-[2px] bg-background/80 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm whitespace-nowrap" style={{ color }}>
            {entity.label}
          </div>
        </Html>
      </mesh>
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
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.35, 0.45, 32]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color="#C9A84C" transparent opacity={0.7} />
      </mesh>
      <Html distanceFactor={15} position={[0, 0.5, 0]} center>
        <div className="rounded-[2px] bg-gold/10 px-2 py-0.5 text-[9px] font-semibold text-gold backdrop-blur-sm whitespace-nowrap border border-gold/20">
          {entity.label}
        </div>
      </Html>
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

export function Scene3DCanvas({ entities, events }: Scene3DCanvasProps) {
  const actorEntities = entities.filter(e => e.entity_type === "actor" || e.entity_type === "vehicle");
  const locationEntities = entities.filter(e => e.entity_type === "location");

  return (
    <Canvas
      camera={{ position: [12, 10, 12], fov: 50, near: 0.1, far: 200 }}
      style={{ background: "#050810", width: "100%", height: "100%" }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.6} color="#ffeedd" />
      <pointLight position={[0, 5, 0]} intensity={0.4} color="#C9A84C" />

      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#C9A84C"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#C9A84C"
        fadeDistance={30}
        fadeStrength={1.5}
        infiniteGrid
        position={[0, 0, 0]}
      />

      {actorEntities.map((e) => (
        <EntityFigure key={e.id} entity={e} events={events} />
      ))}

      {locationEntities.map((l) => (
        <LocationBeacon key={l.id} entity={l} />
      ))}

      <MovementTrails entities={entities} events={events} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={5}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.2}
      />

      <fog attach="fog" args={["#050810", 20, 50]} />
    </Canvas>
  );
}
