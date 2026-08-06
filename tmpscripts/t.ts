import { buildRealWorldScene } from "../src/lib/location-scene.server";
const s = await buildRealWorldScene({ lat: 24.8615984, lng: 67.0290744, radius: 300 });
console.log({status:s.status, source:s.source, address:s.address, buildings:s.buildings.length, roads:s.roads.length, trees:s.trees.length, landmarks:s.landmarks.length, diag:s.diagnostics, radius:s.radiusMeters});
