import type { SceneEntity, SceneEvent } from "@/lib/scene-render";

export type SceneSetting = "shop" | "bank" | "residence" | "office" | "fuel_station" | "warehouse" | "street";
export type WeaponKind = "pistol" | "rifle" | "shotgun" | "smg";

export interface SceneContextSpec {
  setting: SceneSetting;
  suspectCount: number | null;
  weapons: WeaponKind[];
  armedSuspects: boolean;
  entering: boolean;
  interior: boolean;
  summary: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, dou: 2, teen: 3, char: 4, chaar: 4, panch: 5,
  "۱": 1, "۲": 2, "۳": 3, "۴": 4, "۵": 5, "۶": 6, "۷": 7, "۸": 8, "۹": 9, "۱۰": 10,
  "دو": 2, "تین": 3, "چار": 4, "پانچ": 5,
};

const PERSON_WORD = "(?:suspects?|assailants?|robbers?|attackers?|culprits?|men|persons?|afrad|mulzim(?:on)?|log|ملزم|ملزمان|افراد|لوگ)";
const WEAPON_WORD = "(?:pistols?|guns?|revolvers?|rifles?|shotguns?|smgs?|submachine\\s+guns?| firearms?|pistol|بندوق|پستول|گن|رائفل)";

export function explicitSuspectCount(narrative: string): number | null {
  const text = narrative.toLowerCase();
  const number = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|dou|teen|char|chaar|panch|[۰-۹]+|دو|تین|چار|پانچ)";
  const match = new RegExp(`\\b${number}\\s+${PERSON_WORD}\\b`, "i").exec(text)
    ?? new RegExp(`${number}\\s+${PERSON_WORD}`, "i").exec(text);
  if (!match) return null;
  const token = match[1].toLowerCase();
  const value = /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token];
  return value && value > 0 && value <= 10 ? value : null;
}

export function detectWeapons(text: string): WeaponKind[] {
  const narrative = text.toLowerCase();
  const weapons: WeaponKind[] = [];
  if (/(\bpistols?\b|\brevolvers?\b|پستول|pistol)/i.test(narrative)) weapons.push("pistol");
  if (/(\bshotguns?\b|\bsawed[- ]off\b|shotgun)/i.test(narrative)) weapons.push("shotgun");
  if (/(\bsmgs?\b|\bsubmachine\s+guns?\b|\bmini\s+uzis?\b)/i.test(narrative)) weapons.push("smg");
  if (/(\brifles?\b|\bak[- ]?47\b|\bassault\s+rifles?\b|رائفل)/i.test(narrative)) weapons.push("rifle");
  return weapons;
}

export function deriveSceneContext(entities: SceneEntity[], narrative: string): SceneContextSpec {
  const extracted = entities.map((e) => `${e.label} ${e.description ?? ""} ${e.source_text ?? ""}`).join(" ");
  const text = `${narrative}\n${extracted}`.toLowerCase();
  let setting: SceneSetting = "street";
  if (/(\bshop\b|\bstore\b|\bkir(?:y|i)ana\b|\bdukaan\b|\bdukan\b|دکان|گروسری|super\s*store)/i.test(text)) setting = "shop";
  else if (/(\bbank\b|\bteller\b|بینک)/i.test(text)) setting = "bank";
  else if (/(\bpetrol\s+(?:pump|station)\b|\bfuel\s+station\b|\bgas\s+station\b)/i.test(text)) setting = "fuel_station";
  else if (/(\bwarehouse\b|\bgodown\b|گودام)/i.test(text)) setting = "warehouse";
  else if (/(\boffice\b|\bworkplace\b|دفتر)/i.test(text)) setting = "office";
  else if (/(\bhome\b|\bhouse\b|\bresidence\b|\bflat\b|\bapartment\b|\bghar\b|گھر)/i.test(text)) setting = "residence";

  const weapons = detectWeapons(`${narrative}\n${entities.filter((e) => e.entity_type === "object").map((e) => `${e.label} ${e.description ?? ""}`).join(" ")}`);
  const armedSuspects = weapons.length > 0 && (
    new RegExp(`${PERSON_WORD}.{0,100}(?:armed|carrying|holding|with|lekar|liye|${WEAPON_WORD})`, "i").test(text)
    || new RegExp(`(?:armed|carrying|holding|lekar|liye).{0,100}(?:${WEAPON_WORD})`, "i").test(text)
    || /\barmed\s+(?:suspects?|robbers?|assailants?|attackers?|men)\b/i.test(text)
  );
  const entering = /(\benter(?:ed|ing|s)?\b|\bwalk(?:ed|ing)?\s+into\b|\bstormed\b|\bbarged\b|\bdakhil\b|\bdakhal\b|داخل)/i.test(text);
  const interior = setting !== "street" && setting !== "fuel_station";
  const suspectCount = explicitSuspectCount(narrative);
  const summary = [
    `${suspectCount ?? entities.filter((e) => e.entity_type === "actor" && e.entity_role === "suspect").length} suspect${suspectCount === 1 ? "" : "s"}`,
    ...weapons.map((weapon) => weapon.toUpperCase()),
    setting.replace("_", " ").toUpperCase(),
    ...(entering ? ["ENTRY ACTION"] : []),
  ];
  return { setting, suspectCount, weapons, armedSuspects, entering, interior, summary };
}

function metadata(entity: SceneEntity): Record<string, unknown> {
  return entity.metadata && typeof entity.metadata === "object" && !Array.isArray(entity.metadata)
    ? entity.metadata as Record<string, unknown>
    : {};
}

function syntheticActor(jobId: string | null | undefined, index: number, narrative: string): SceneEntity {
  return {
    id: `statement-suspect-${jobId ?? "scene"}-${index + 1}`,
    job_id: jobId ?? "",
    entity_type: "actor",
    entity_role: "suspect",
    label: `Suspect ${index + 1}`,
    description: "Person added from the explicit suspect count in the FIR statement.",
    color: "#ef4444",
    confidence: 0.88,
    position_x: (index - 0.5) * 1.25,
    position_y: 0,
    position_z: 4.8 + index * 0.35,
    source_text: narrative.match(new RegExp(`.{0,50}${PERSON_WORD}.{0,80}`, "i"))?.[0] ?? "Explicit suspect count in FIR",
    metadata: { inferred: true, source: "statement_count" },
    created_at: new Date(0).toISOString(),
  } as unknown as SceneEntity;
}

/** Reconciles the renderer with statement-critical counts and props, including old completed jobs. */
export function reconcileSceneEntities(
  input: SceneEntity[],
  narrative: string,
  jobId: string | null | undefined,
  context: SceneContextSpec,
): SceneEntity[] {
  let entities = [...input];
  if (context.suspectCount !== null) {
    const suspects = entities.filter((e) => e.entity_type === "actor" && e.entity_role === "suspect");
    const others = entities.filter((e) => !(e.entity_type === "actor" && e.entity_role === "suspect"));
    const selected = suspects.slice(0, context.suspectCount);
    while (selected.length < context.suspectCount) selected.push(syntheticActor(jobId, selected.length, narrative));
    entities = [...selected.map((entity, index) => ({
      ...entity,
      label: /^suspect(?:\s*\d+)?$/i.test(entity.label.trim()) ? `Suspect ${index + 1}` : entity.label,
      position_x: context.entering && context.interior ? (index - (selected.length - 1) / 2) * 1.35 : entity.position_x,
      position_z: context.entering && context.interior ? 5.4 + index * 0.4 : entity.position_z,
      metadata: {
        ...metadata(entity),
        suspectIndex: index,
        ...(context.armedSuspects && context.weapons[0] ? { weaponKind: context.weapons[0] } : {}),
      },
    })), ...others];
  } else if (context.armedSuspects && context.weapons[0]) {
    entities = entities.map((entity) => entity.entity_type === "actor" && entity.entity_role === "suspect"
      ? { ...entity, metadata: { ...metadata(entity), weaponKind: context.weapons[0] } }
      : entity);
  }

  for (const weapon of context.weapons) {
    if (entities.some((e) => e.entity_type === "object" && detectWeapons(`${e.label} ${e.description ?? ""}`).includes(weapon))) continue;
    entities.push({
      id: `statement-weapon-${jobId ?? "scene"}-${weapon}`,
      job_id: jobId ?? "",
      entity_type: "object",
      entity_role: null,
      label: weapon === "smg" ? "Submachine gun" : weapon[0].toUpperCase() + weapon.slice(1),
      description: `Statement-critical ${weapon} carried by the armed suspect${context.suspectCount === 1 ? "" : "s"}.`,
      color: "#64748b",
      confidence: 0.94,
      position_x: 0,
      position_y: 0,
      position_z: 0,
      source_text: "Weapon explicitly mentioned in the FIR statement.",
      metadata: { inferred: true, weaponKind: weapon },
      created_at: new Date(0).toISOString(),
    } as unknown as SceneEntity);
  }
  return entities;
}

function entryEvent(entity: SceneEntity, index: number, total: number, context: SceneContextSpec, sequence: number): SceneEvent {
  const x = (index - (total - 1) / 2) * 1.35;
  const place = context.setting.replace("_", " ");
  return {
    id: `statement-entry-${entity.id}`,
    job_id: entity.job_id,
    entity_id: entity.id,
    sequence_number: sequence,
    action_label: `enter ${place}`,
    description: `${entity.label} enters the ${place}, matching the FIR statement.`,
    origin_x: x,
    origin_y: 0,
    origin_z: 5.4 + index * 0.4,
    dest_x: x * 0.75,
    dest_y: 0,
    dest_z: 0.85 + index * 0.35,
    duration_seconds: 3,
    source_text: entity.source_text,
    created_at: new Date(0).toISOString(),
  } as unknown as SceneEvent;
}

/** Gives every explicitly counted suspect their own visible entrance action. */
export function reconcileSceneEvents(entities: SceneEntity[], events: SceneEvent[], context: SceneContextSpec): SceneEvent[] {
  if (!context.entering || !context.interior) return events;
  const suspects = entities.filter((e) => e.entity_type === "actor" && e.entity_role === "suspect");
  if (suspects.length === 0) return events;
  const isEntry = (event: SceneEvent) => /(enter|entered|entering|dakhil|dakhal|داخل)/i.test(`${event.action_label ?? ""} ${event.description ?? ""}`);
  const entries = suspects.map((entity, index) => {
    const existing = events.find((event) => event.entity_id === entity.id && isEntry(event));
    const generated = entryEvent(entity, index, suspects.length, context, index + 1);
    return existing ? { ...existing, ...generated, id: existing.id } : generated;
  });
  const remaining = events.filter((event) => !entries.some((entry) => entry.id === event.id));
  return [...entries, ...remaining]
    .sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0))
    .map((event, index) => ({ ...event, sequence_number: index + 1 }));
}
