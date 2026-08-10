import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { HQ_ROOM } from "../officeReducer";
import type { Character } from "../officeReducer";
import type { Vec2 } from "./deskLayout";

const PALETTE: Record<string, { body: string; hair: string; skin: string; pants: string }> = {
  "research-dept": { body: "#3d7ea6", hair: "#3a2a20", skin: "#e8b98a", pants: "#26333d" },
  "planning-dept": { body: "#8a5cc2", hair: "#241a2e", skin: "#f0c9a0", pants: "#2e2438" },
  "dev-dept": { body: "#3fae6a", hair: "#1c1c1c", skin: "#e0ab7c", pants: "#22331f" },
  [HQ_ROOM]: { body: "#b08d57", hair: "#3a2a20", skin: "#e8b98a", pants: "#4a3a28" },
};
const DEFAULT_PALETTE = { body: "#8a8a8a", hair: "#2b2b2b", skin: "#d8b48a", pants: "#3a3a3a" };
const INACTIVE_COLOR = "#767676";

const BOB_AMPLITUDE = 0.08;
const BOB_SPEED = 2.2;

export function CharacterActor({ character, home }: { character: Character; home: Vec2 }) {
  const groupRef = useRef<Group>(null);
  const palette = PALETTE[character.agentType] ?? DEFAULT_PALETTE;

  useFrame(() => {
    if (!groupRef.current) return;
    const bobbing = character.active;
    groupRef.current.position.y = bobbing ? Math.sin((performance.now() / 1000) * BOB_SPEED) * BOB_AMPLITUDE : 0;
  });

  const skinColor = character.active ? palette.skin : INACTIVE_COLOR;
  const bodyColor = character.active ? palette.body : INACTIVE_COLOR;
  const hairColor = character.active ? palette.hair : INACTIVE_COLOR;
  const pantsColor = character.active ? palette.pants : INACTIVE_COLOR;
  const opacity = character.active ? 1 : 0.5;

  return (
    <group ref={groupRef} position={[home.x, 0, home.z]}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.35, 0.4, 0.25]} />
        <meshStandardMaterial color={pantsColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.4, 0.5, 0.25]} />
        <meshStandardMaterial color={bodyColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[-0.28, 0.55, 0]}>
        <boxGeometry args={[0.12, 0.4, 0.2]} />
        <meshStandardMaterial color={bodyColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0.28, 0.55, 0]}>
        <boxGeometry args={[0.12, 0.4, 0.2]} />
        <meshStandardMaterial color={bodyColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color={skinColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[0.34, 0.14, 0.34]} />
        <meshStandardMaterial color={hairColor} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}
