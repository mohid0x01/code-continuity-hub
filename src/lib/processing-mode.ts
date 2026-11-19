export type RenderMode = "ai" | "system";

export const ENGINE_STAGES = [
  { key: "preprocessing", title: "Stage 1 · FIR Text Parsing", desc: "Reading the statement locally with deterministic SCENEIQ Engine rules — no AI request" },
  { key: "entity_extraction", title: "Stage 2 · Rule-Based Entity Mapping", desc: "Mapping stated people, vehicles, weapons and setting without an AI model" },
  { key: "spatial_resolution", title: "Stage 3 · Spatial Layout", desc: "Placing every mapped entity around the selected real-world incident pin" },
  { key: "timeline_sequencing", title: "Stage 4 · Event Sequencing", desc: "Creating deterministic chronological actions for the mapped entities" },
  { key: "scene_generation", title: "Stage 5 · 3D Scene Generation", desc: "Saving the Engine-built scene for the interactive 3D viewer" },
] as const;

export const AI_STAGES = [
  { key: "preprocessing", title: "Stage 1 · Narrative Preprocessing", desc: "Loading FIR text and detecting its language for AI-assisted reconstruction" },
  { key: "entity_extraction", title: "Stage 2 · AI Entity & Event Extraction", desc: "Calling the AI model chain for structured scene entities and actions" },
  { key: "spatial_resolution", title: "Stage 3 · Spatial Coordinate Resolution", desc: "Validating the AI output and resolving 3D positions for every entity" },
  { key: "timeline_sequencing", title: "Stage 4 · Timeline Sequencing", desc: "Re-ordering AI-extracted events chronologically and linking them to entities" },
  { key: "scene_generation", title: "Stage 5 · 3D Scene Manifest", desc: "Building and saving the AI-assisted scene graph" },
] as const;

export function isAiRenderMode(mode: string | null | undefined): mode is "ai" {
  return mode === "ai";
}

export function stagesForRenderMode(mode: string | null | undefined) {
  return isAiRenderMode(mode) ? AI_STAGES : ENGINE_STAGES;
}
