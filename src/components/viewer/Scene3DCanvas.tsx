import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Environment, ContactShadows } from "@react-three/drei";
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
  const groupRef = useRef<THREE.Group>(null);
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

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.lerp(targetPos, 0.08);
      // Face direction of motion
      const dir = new THREE.Vector3().subVectors(targetPos, meshRef.current.position);
      if (dir.lengthSq() > 0.001) {
        const angle = Math.atan2(dir.x, dir.z);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, angle, 0.1);
      }
      // Subtle idle bob
      meshRef.current.position.y = targetPos.y + Math.sin(clock.getElapsedTime() * 3) * 0.03;
    }
  });

  const color = entity.color || "#C9A84C";
  const roleTint = entity.entity_role === "suspect" ? "#ef4444"
    : entity.entity_role === "victim" ? "#3b82f6"
    : entity.entity_role === "witness" ? "#22c55e"
    : color;

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} castShadow position={[positions[0][0], positions[0][1] + 0.75, positions[0][2]]}>
        {/* Torso */}
        <capsuleGeometry args={[0.22, 0.7, 12, 24]} />
        <meshStandardMaterial color={roleTint} roughness={0.55} metalness={0.15} />
        {/* Head */}
        <mesh position={[0, 0.65, 0]} castShadow>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#e8c9a0" roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Shoulder pads / arms */}
        <mesh position={[0.28, 0.15, 0]} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color={roleTint} roughness={0.6} />
        </mesh>
        <mesh position={[-0.28, 0.15, 0]} castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color={roleTint} roughness={0.6} />
        </mesh>
        {/* Direction indicator */}
        <mesh position={[0, 0, 0.22]}>
          <coneGeometry args={[0.06, 0.14, 8]} />
          <meshStandardMaterial color={roleTint} emissive={roleTint} emissiveIntensity={0.9} />
        </mesh>
        <Html distanceFactor={12} position={[0, 1.15, 0]} center>
          <div className="rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
               style={{ color: roleTint, borderColor: roleTint, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
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

export function Scene3DCanvas({ entities, events }: Scene3DCanvasProps) {
  const actorEntities = entities.filter(e => e.entity_type === "actor" || e.entity_type === "vehicle");
  const locationEntities = entities.filter(e => e.entity_type === "location");

  return (
    <Canvas
      shadows
      camera={{ position: [12, 10, 12], fov: 45, near: 0.1, far: 200 }}
      style={{ background: "linear-gradient(180deg, #0a1220 0%, #050810 100%)", width: "100%", height: "100%" }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1, preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#88a8ff", "#402010", 0.4]} />
      <directionalLight
        castShadow
        position={[14, 20, 12]}
        intensity={1.1}
        color="#ffe4c0"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <pointLight position={[0, 6, 0]} intensity={0.5} color="#C9A84C" />
      <Environment preset="city" />

      {/* Ground plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0f1622" roughness={0.9} metalness={0.05} />
      </mesh>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={40} blur={2.5} far={10} />

      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#3a2f18"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#C9A84C"
        fadeDistance={30}
        fadeStrength={1.5}
        infiniteGrid
        position={[0, 0.02, 0]}
      />

      {actorEntities.map((e) => (
        <EntityFigure key={e.id} entity={e} events={events} />
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
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.2}
      />

      <fog attach="fog" args={["#050810", 20, 50]} />
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
