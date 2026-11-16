import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { SceneContextSpec } from "@/lib/scene-context";
import { useSceneMaterials, disposeSceneMaterials } from "./SceneMaterials";

function finishTexture(texture: THREE.CanvasTexture, repeatX = 1, repeatY = 1) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

function tileTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#aaa69c";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const shade = 174 + ((x * 17 + y * 29) % 18);
      ctx.fillStyle = `rgb(${shade + 7},${shade + 5},${shade})`;
      ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      ctx.strokeStyle = "rgba(80,75,68,.12)";
      ctx.strokeRect(x * 64 + 4, y * 64 + 4, 56, 56);
    }
  }
  for (let i = 0; i < 900; i += 1) {
    const x = (i * 83) % 512;
    const y = (i * 197) % 512;
    ctx.fillStyle = `rgba(55,50,43,${0.015 + (i % 4) * 0.008})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return finishTexture(new THREE.CanvasTexture(canvas), 3, 3);
}

function woodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#65503c";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 3) {
    const wave = Math.sin(y * 0.11) * 12;
    ctx.strokeStyle = `rgba(35,20,12,${0.05 + (y % 11) * 0.006})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(140, y + wave, 340, y - wave, 512, y + wave * 0.3);
    ctx.stroke();
  }
  return finishTexture(new THREE.CanvasTexture(canvas), 2, 1);
}

function signTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 220;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e5e0d5";
  ctx.fillRect(0, 0, 1024, 220);
  ctx.strokeStyle = "#2d3134";
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 1010, 206);
  ctx.fillStyle = "#22282c";
  ctx.font = "700 82px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.toUpperCase(), 512, 111);
  return finishTexture(new THREE.CanvasTexture(canvas));
}

function NormalizedModel({ url, targetHeight, position, rotation = [0, 0, 0] }: {
  url: string;
  targetHeight: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const source = Array.isArray(child.material) ? child.material : [child.material];
      const cloned = source.map((material) => material.clone());
      child.material = Array.isArray(child.material) ? cloned : cloned[0];
      for (const material of cloned) {
        if (material instanceof THREE.MeshStandardMaterial) material.envMapIntensity = 0.9;
      }
    });
    clone.updateMatrixWorld(true);
    const initial = new THREE.Box3().setFromObject(clone);
    const size = initial.getSize(new THREE.Vector3());
    clone.scale.setScalar(targetHeight / Math.max(size.y, 0.001));
    clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const center = bounds.getCenter(new THREE.Vector3());
    clone.position.add(new THREE.Vector3(-center.x, -bounds.min.y, -center.z));
    return clone;
  }, [scene, targetHeight]);
  return <group position={position} rotation={rotation}><primitive object={model} /></group>;
}

function Stock({ position, rows = 4 }: { position: [number, number, number]; rows?: number }) {
  const boxes = useMemo(() => Array.from({ length: rows * 7 }, (_, i) => ({
    x: (i % 7 - 3) * 0.125,
    y: 0.26 + Math.floor(i / 7) * 0.43,
    z: 0.02 + (i % 2) * 0.035,
    h: 0.18 + (i % 3) * 0.035,
    color: ["#8e3f32", "#c1a35f", "#516b63", "#d0c5aa", "#435e78"][i % 5],
  })), [rows]);
  return <group position={position}>
    {boxes.map((box, index) => <mesh key={index} castShadow position={[box.x, box.y, box.z]}>
      <boxGeometry args={[0.095, box.h, 0.11]} />
      <meshStandardMaterial color={box.color} roughness={0.72} />
    </mesh>)}
  </group>;
}

function InteriorShell({ setting }: { setting: SceneContextSpec["setting"] }) {
  const materials = useSceneMaterials();
  useEffect(() => () => disposeSceneMaterials(materials), [materials]);
  const tile = useMemo(tileTexture, []);
  const sign = useMemo(() => signTexture(setting === "shop" ? "SHOP · FIR RECONSTRUCTION" : setting.replace("_", " ")), [setting]);
  useEffect(() => () => { tile.dispose(); sign.dispose(); }, [tile, sign]);
  return <group>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
      <planeGeometry args={[10, 8.6]} />
      <meshStandardMaterial map={tile} roughness={0.58} metalness={0.03} color="#ddd8cd" />
    </mesh>
    <mesh castShadow receiveShadow position={[0, 1.65, -4.25]}>
      <boxGeometry args={[10, 3.3, 0.18]} />
      <primitive object={materials.concrete} attach="material" />
    </mesh>
    {[-4.92, 4.92].map((x) => <mesh key={x} castShadow receiveShadow position={[x, 1.65, 0]}>
      <boxGeometry args={[0.18, 3.3, 8.6]} />
      <primitive object={materials.concrete} attach="material" />
    </mesh>)}
    {[-4.05, 4.05].map((x) => <mesh key={x} castShadow receiveShadow position={[x, 1.65, 4.25]}>
      <boxGeometry args={[1.9, 3.3, 0.18]} />
      <primitive object={materials.concrete} attach="material" />
    </mesh>)}
    <mesh castShadow position={[0, 3.02, 4.25]}>
      <boxGeometry args={[6.2, 0.55, 0.2]} />
      <primitive object={materials.concrete} attach="material" />
    </mesh>
    <mesh position={[0, 2.95, 4.37]}>
      <planeGeometry args={[4.4, 0.75]} />
      <meshStandardMaterial map={sign} roughness={0.62} />
    </mesh>
    {[-1.55, 1.55].map((x) => <group key={x} position={[x, 0, 4.18]}>
      <mesh castShadow position={[0, 1.35, 0]}><boxGeometry args={[0.09, 2.7, 0.12]} /><meshStandardMaterial color="#343a3d" metalness={0.75} roughness={0.3} /></mesh>
    </group>)}
    <group position={[-1.52, 0, 4.15]} rotation={[0, -1.08, 0]}>
      <mesh castShadow position={[0.72, 1.33, 0]}><boxGeometry args={[1.44, 2.62, 0.055]} /><meshStandardMaterial color="#9db1b6" transparent opacity={0.2} roughness={0.08} metalness={0.25} /></mesh>
      <mesh position={[1.28, 1.25, 0.06]}><cylinderGeometry args={[0.025, 0.025, 0.5, 10]} /><meshStandardMaterial color="#a9a9a4" metalness={0.9} roughness={0.22} /></mesh>
    </group>
    {[-2.2, 2.2].map((x) => <group key={x}>
      <mesh position={[x, 3.05, -0.3]}><boxGeometry args={[1.7, 0.07, 0.45]} /><meshStandardMaterial color="#f1eee3" emissive="#fff4d8" emissiveIntensity={1.8} /></mesh>
      <pointLight position={[x, 2.85, -0.3]} intensity={22} distance={10} decay={2} color="#fff1d4" />
    </group>)}
    <mesh position={[0, 0.09, 4.18]} receiveShadow><boxGeometry args={[3.1, 0.06, 0.55]} /><meshStandardMaterial color="#77746b" roughness={0.9} /></mesh>
  </group>;
}

function ShopProps() {
  const wood = useMemo(woodTexture, []);
  useEffect(() => () => wood.dispose(), [wood]);
  return <group>
    {[-3.35, -2.15, 2.15, 3.35].map((x) => <group key={x} position={[x, 0.08, -3.85]}>
      <NormalizedModel url="/models/Shelf_01/Shelf_01_1k.gltf" targetHeight={2.15} position={[0, 0, 0]} />
      <Stock position={[0, 0.05, 0.16]} />
    </group>)}
    <group position={[-4.35, 0.08, -0.8]} rotation={[0, Math.PI / 2, 0]}>
      <NormalizedModel url="/models/Shelf_01/Shelf_01_1k.gltf" targetHeight={2.15} position={[0, 0, 0]} />
      <Stock position={[0, 0.05, 0.16]} />
    </group>
    <group position={[2.65, 0.08, 0.1]}>
      <mesh castShadow receiveShadow position={[0, 0.53, 0]}><boxGeometry args={[2.55, 1.06, 1.05]} /><meshStandardMaterial map={wood} roughness={0.5} /></mesh>
      <mesh castShadow position={[0, 1.08, 0]}><boxGeometry args={[2.72, 0.09, 1.18]} /><meshStandardMaterial color="#353b3d" roughness={0.3} metalness={0.15} /></mesh>
      <NormalizedModel url="/models/CashRegister_01/CashRegister_01_1k.gltf" targetHeight={0.43} position={[0.35, 1.13, 0]} rotation={[0, Math.PI, 0]} />
      <mesh castShadow position={[-0.72, 1.2, 0.1]}><boxGeometry args={[0.34, 0.2, 0.28]} /><meshStandardMaterial color="#d0c3a5" roughness={0.85} /></mesh>
    </group>
    <group position={[3.95, 0.08, -1.85]}>
      <mesh castShadow position={[0, 1.05, 0]}><boxGeometry args={[1.25, 2.1, 0.78]} /><meshStandardMaterial color="#c4c7c4" roughness={0.34} metalness={0.38} /></mesh>
      <mesh position={[0, 1.18, 0.401]}><planeGeometry args={[1.08, 1.55]} /><meshPhysicalMaterial color="#a7c1c4" transparent opacity={0.3} roughness={0.08} metalness={0.1} /></mesh>
      <mesh position={[-0.46, 1.1, 0.46]}><boxGeometry args={[0.035, 0.7, 0.04]} /><meshStandardMaterial color="#d9dad5" metalness={0.8} roughness={0.2} /></mesh>
    </group>
  </group>;
}

function ContextProps({ setting }: { setting: SceneContextSpec["setting"] }) {
  if (setting === "shop") return <ShopProps />;
  if (setting === "warehouse") return <group>{[-3, -1, 1, 3].map((x) => <group key={x} position={[x, 0.08, -3.7]}><NormalizedModel url="/models/Shelf_01/Shelf_01_1k.gltf" targetHeight={2.2} position={[0, 0, 0]} /><Stock position={[0, 0, 0.15]} /></group>)}</group>;
  return <group>
    {[-2.4, 0, 2.4].map((x) => <group key={x} position={[x, 0.08, -1.7]}>
      <mesh castShadow receiveShadow position={[0, 0.55, 0]}><boxGeometry args={[1.85, 1.1, 0.85]} /><meshStandardMaterial color={setting === "bank" ? "#5f5548" : "#737775"} roughness={0.52} /></mesh>
      <mesh castShadow position={[0, 1.12, 0]}><boxGeometry args={[2, 0.08, 1]} /><meshStandardMaterial color="#34393a" roughness={0.3} /></mesh>
      {setting === "bank" && <mesh position={[0, 1.75, 0]}><boxGeometry args={[1.75, 1.15, 0.035]} /><meshPhysicalMaterial color="#b7cbcd" transparent opacity={0.25} roughness={0.06} /></mesh>}
    </group>)}
    {setting === "residence" && <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0.4]}><planeGeometry args={[3.8, 2.6]} /><meshStandardMaterial color="#68544b" roughness={0.98} /></mesh>
      <NormalizedModel url="/models/Shelf_01/Shelf_01_1k.gltf" targetHeight={1.8} position={[-3.6, 0.08, -3.7]} />
    </>}
  </group>;
}

export function SceneContextEnvironment({ context }: { context: SceneContextSpec }) {
  if (!context.interior) return null;
  return <group name={`fir-${context.setting}-interior`}>
    <InteriorShell setting={context.setting} />
    <ContextProps setting={context.setting} />
  </group>;
}
