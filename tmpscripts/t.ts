import { buildRealWorldScene } from "../src/lib/location-scene.server";
const s = await buildRealWorldScene({ lat: 27.6993516, lng: 68.8592537, radius: 300 });
console.log({status:s.status, source:s.source, address:s.address, buildings:s.buildings.length, roads:s.roads.length, trees:s.trees.length, landmarks:s.landmarks.length, diag:s.diagnostics, radius:s.radiusMeters});
