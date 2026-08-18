import { HQ_ROOM } from "../officeReducer";

export const CHARACTER_FILE: Record<string, string> = {
  "research-dept": "char_0.png",
  "planning-dept": "char_1.png",
  "dev-dept": "char_2.png",
  "design-publishing-dept": "char_3.png",
  [HQ_ROOM]: "char_4.png",
};
const DEFAULT_CHARACTER_FILE = "char_5.png";

export function characterFileFor(agentType: string): string {
  return CHARACTER_FILE[agentType] ?? DEFAULT_CHARACTER_FILE;
}

const CHARACTER_ASSET_BASE = "/pixel-agents-assets/characters/";
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Returns a shared, lazily-created <img> for the character file mapped to
 * agentType. The same HTMLImageElement instance is reused across all
 * characters sharing a department, so the browser only fetches each of the
 * 6 sprite sheets once.
 */
export function characterImageFor(agentType: string): HTMLImageElement {
  const file = characterFileFor(agentType);
  let img = imageCache.get(file);
  if (!img) {
    img = new Image();
    img.src = `${CHARACTER_ASSET_BASE}${file}`;
    imageCache.set(file, img);
  }
  return img;
}
