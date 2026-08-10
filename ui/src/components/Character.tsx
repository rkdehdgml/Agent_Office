import type { Character as CharacterModel } from "../officeReducer";

const PALETTES: Record<string, { body: string; hair: string; skin: string; pants: string }> = {
  "본부": { body: "#b08d57", hair: "#3a2a20", skin: "#e8b98a", pants: "#4a3a28" },
  "research-dept": { body: "#3d7ea6", hair: "#3a2a20", skin: "#e8b98a", pants: "#26333d" },
  "planning-dept": { body: "#8a5cc2", hair: "#241a2e", skin: "#f0c9a0", pants: "#2e2438" },
  "dev-dept": { body: "#3fae6a", hair: "#1c1c1c", skin: "#e0ab7c", pants: "#22331f" },
};

const DEFAULT_PALETTE = { body: "#8a8a8a", hair: "#2b2b2b", skin: "#d8b48a", pants: "#3a3a3a" };

function paletteFor(agentType: string) {
  return PALETTES[agentType] ?? DEFAULT_PALETTE;
}

export function CharacterView({ character }: { character: CharacterModel }) {
  const palette = paletteFor(character.agentType);
  return (
    <div className={`character ${character.active ? "active" : "inactive"}`}>
      <div className={`sprite ${character.active ? "idle-bob" : ""}`}>
        <div className="px head" style={{ background: palette.skin }} />
        <div className="px hair" style={{ background: palette.hair }} />
        <div className="px eye l" />
        <div className="px eye r" />
        <div className="px body" style={{ background: palette.body }} />
        <div className="px arm l" style={{ background: palette.body }} />
        <div className="px arm r" style={{ background: palette.body }} />
        <div className="px legs" style={{ background: palette.pants }} />
        <div className="px foot l" />
        <div className="px foot r" />
      </div>
      <div className="character-status">{character.status}</div>
    </div>
  );
}
