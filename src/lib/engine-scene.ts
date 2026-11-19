import { deriveSceneContext, detectWeapons, type SceneSetting } from "./scene-context";
import { MOTORCYCLE_WORDS, VEHICLE_WORDS } from "./scene-render";

export type EngineEntity = {
  entity_type: "actor" | "vehicle" | "location" | "object";
  entity_role: "suspect" | "victim" | "witness" | "bystander" | "none";
  label: string;
  description: string;
  confidence: number;
  position_x: number;
  position_y: number;
  position_z: number;
  source_text: string;
};

export type EngineEvent = {
  sequence_number: number;
  entity_label: string;
  action_label: string;
  description: string;
  origin_x: number;
  origin_y: number;
  origin_z: number;
  dest_x: number;
  dest_y: number;
  dest_z: number;
  duration_seconds: number;
  source_text: string;
};

export type EngineScene = { entities: EngineEntity[]; events: EngineEvent[] };

const NUMBER_VALUES: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  ek: 1, do: 2, dou: 2, teen: 3, char: 4, chaar: 4, panch: 5,
  "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5,
  "دو": 2, "تین": 3, "چار": 4, "پانچ": 5,
};
const NUMBER_TOKEN = "(a|an|one|two|three|four|five|ek|do|dou|teen|char|chaar|panch|\\d+|[۰-۹]+|دو|تین|چار|پانچ)";
const SUSPECT_WORD = "(?:suspects?|assailants?|robbers?|attackers?|culprits?|mulzim(?:on)?|ملزم|ملزمان)";
const VICTIM_WORD = "(?:victims?|complainants?|mutasir(?:een)?|shikaar|متاثر|متاثرین|شکایت\\s+کنندہ)";
const WITNESS_WORD = "(?:witness(?:es)?|gawah|گواہ|گواہان)";
const BYSTANDER_WORD = "(?:bystanders?|onlookers?|mojood\\s+log|حاضر\\s+افراد)";

function explicitCount(narrative: string, personWord: string): number | null {
  const match = new RegExp(`\\b${NUMBER_TOKEN}\\s+${personWord}\\b`, "i").exec(narrative)
    ?? new RegExp(`${NUMBER_TOKEN}\\s+${personWord}`, "i").exec(narrative);
  if (!match) return null;
  const token = match[1].toLowerCase();
  const value = /^\d+$/.test(token) ? Number(token) : NUMBER_VALUES[token];
  return value && value > 0 && value <= 10 ? value : null;
}

function mentionedCount(narrative: string, personWord: string): number {
  return explicitCount(narrative, personWord)
    ?? (new RegExp(`\\b${personWord}\\b`, "i").test(narrative) ? 1 : 0);
}

const LOCATION_LABELS: Record<SceneSetting, string> = {
  shop: "Shop",
  bank: "Bank",
  residence: "Residence",
  office: "Office",
  fuel_station: "Fuel Station",
  warehouse: "Warehouse",
  street: "Street",
};

function actor(
  role: EngineEntity["entity_role"],
  index: number,
  total: number,
  narrative: string,
): EngineEntity {
  const label = `${role[0].toUpperCase()}${role.slice(1)} ${index + 1}`;
  const x = (index - (total - 1) / 2) * 1.35;
  return {
    entity_type: "actor",
    entity_role: role,
    label,
    description: `${label} mapped directly from the people stated in the FIR using the deterministic SCENEIQ Engine.`,
    confidence: 0.94,
    position_x: x,
    position_y: 0,
    position_z: role === "suspect" ? 5.4 + index * 0.4 : -1.5 + index * 0.4,
    source_text: narrative.slice(0, 500),
  };
}

/**
 * Builds the scene entirely with local rules. This module has no provider client,
 * network request or model selection: SCENEIQ Engine jobs never call an AI API.
 */
export function buildEngineScene(narrative: string): EngineScene {
  const context = deriveSceneContext([], narrative);
  const entities: EngineEntity[] = [];
  const events: EngineEvent[] = [];

  const suspectCount = context.suspectCount ?? mentionedCount(narrative, SUSPECT_WORD);
  const victimCount = mentionedCount(narrative, VICTIM_WORD);
  const witnessCount = mentionedCount(narrative, WITNESS_WORD);
  const bystanderCount = mentionedCount(narrative, BYSTANDER_WORD);

  for (let index = 0; index < suspectCount; index++) entities.push(actor("suspect", index, suspectCount, narrative));
  for (let index = 0; index < victimCount; index++) entities.push(actor("victim", index, victimCount, narrative));
  for (let index = 0; index < witnessCount; index++) entities.push(actor("witness", index, witnessCount, narrative));
  for (let index = 0; index < bystanderCount; index++) entities.push(actor("bystander", index, bystanderCount, narrative));

  const place = context.setting.replace("_", " ");
  entities.push({
    entity_type: "location",
    entity_role: "none",
    label: LOCATION_LABELS[context.setting],
    description: `${LOCATION_LABELS[context.setting]} setting detected from the FIR and anchored to the officer-selected incident coordinates.`,
    confidence: 0.96,
    position_x: 0,
    position_y: 0,
    position_z: 0,
    source_text: narrative.slice(0, 500),
  });

  for (const weapon of detectWeapons(narrative)) {
    entities.push({
      entity_type: "object",
      entity_role: "none",
      label: weapon === "smg" ? "Submachine gun" : `${weapon[0].toUpperCase()}${weapon.slice(1)}`,
      description: `Statement-critical ${weapon} mapped by the deterministic SCENEIQ Engine.`,
      confidence: 0.96,
      position_x: 0,
      position_y: 0,
      position_z: 0,
      source_text: narrative.slice(0, 500),
    });
  }

  const hasMotorcycle = MOTORCYCLE_WORDS.test(narrative);
  const hasVehicle = hasMotorcycle || VEHICLE_WORDS.test(narrative);
  if (hasVehicle) {
    entities.push({
      entity_type: "vehicle",
      entity_role: "none",
      label: hasMotorcycle ? "Motorcycle" : "Car",
      description: `${hasMotorcycle ? "Motorcycle" : "Vehicle"} explicitly mentioned in the FIR statement.`,
      confidence: 0.94,
      position_x: 4,
      position_y: 0,
      position_z: -3,
      source_text: narrative.slice(0, 500),
    });
  }

  const addEvent = (event: Omit<EngineEvent, "sequence_number">) => {
    events.push({ ...event, sequence_number: events.length + 1 });
  };

  const suspects = entities.filter((entity) => entity.entity_role === "suspect");
  suspects.forEach((entity, index) => {
    const x = (index - (suspects.length - 1) / 2) * 1.35;
    if (context.entering && context.interior) {
      addEvent({
        entity_label: entity.label,
        action_label: `enter ${place}`,
        description: `${entity.label} enters the ${place}, matching the FIR statement.`,
        origin_x: x,
        origin_y: 0,
        origin_z: 5.4 + index * 0.4,
        dest_x: x * 0.75,
        dest_y: 0,
        dest_z: 0.85 + index * 0.35,
        duration_seconds: 3,
        source_text: narrative.slice(0, 500),
      });
    } else {
      addEvent({
        entity_label: entity.label,
        action_label: "present at scene",
        description: `${entity.label} is shown at the incident scene as stated in the FIR.`,
        origin_x: entity.position_x,
        origin_y: 0,
        origin_z: entity.position_z,
        dest_x: entity.position_x,
        dest_y: 0,
        dest_z: entity.position_z,
        duration_seconds: 2,
        source_text: narrative.slice(0, 500),
      });
    }
  });

  for (const entity of entities.filter((item) => ["victim", "witness", "bystander"].includes(item.entity_role))) {
    addEvent({
      entity_label: entity.label,
      action_label: "present at scene",
      description: `${entity.label} is shown at the incident scene as stated in the FIR.`,
      origin_x: entity.position_x,
      origin_y: 0,
      origin_z: entity.position_z,
      dest_x: entity.position_x,
      dest_y: 0,
      dest_z: entity.position_z,
      duration_seconds: 2,
      source_text: narrative.slice(0, 500),
    });
  }

  const vehicle = entities.find((entity) => entity.entity_type === "vehicle");
  if (vehicle) {
    const parked = /(\bparked\b|\bstanding\b|کھڑی|کھڑا|روکی|رکی)/i.test(narrative);
    addEvent({
      entity_label: vehicle.label,
      action_label: parked ? "parked at scene" : "arrives at scene",
      description: parked
        ? `${vehicle.label} is shown parked at the incident location as stated in the FIR.`
        : `${vehicle.label} is shown arriving at the incident location as stated in the FIR.`,
      origin_x: vehicle.position_x - (parked ? 0 : 8),
      origin_y: 0,
      origin_z: vehicle.position_z - (parked ? 0 : 5),
      dest_x: vehicle.position_x,
      dest_y: 0,
      dest_z: vehicle.position_z,
      duration_seconds: parked ? 2 : 4,
      source_text: narrative.slice(0, 500),
    });
  }

  return { entities, events };
}
