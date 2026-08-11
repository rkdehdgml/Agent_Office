import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { HQ_ROOM } from "../officeReducer";
import type { Character } from "../officeReducer";
import type { Vec2 } from "./deskLayout";
import type { WalkCommand } from "./useWalkerCommands";
import { animationClipFor } from "./animationClip";
import { useCharacterSpriteTexture } from "./useCharacterSpriteTexture";
import { StatusLabel } from "./StatusLabel";

const PALETTE: Record<string, { body: string; hair: string; skin: string; pants: string }> = {
  "research-dept": { body: "#3d7ea6", hair: "#3a2a20", skin: "#e8b98a", pants: "#26333d" },
  "planning-dept": { body: "#8a5cc2", hair: "#241a2e", skin: "#f0c9a0", pants: "#2e2438" },
  "dev-dept": { body: "#3fae6a", hair: "#1c1c1c", skin: "#e0ab7c", pants: "#22331f" },
  [HQ_ROOM]: { body: "#b08d57", hair: "#3a2a20", skin: "#e8b98a", pants: "#4a3a28" },
};
const DEFAULT_PALETTE = { body: "#8a8a8a", hair: "#2b2b2b", skin: "#d8b48a", pants: "#3a3a3a" };
const INACTIVE_COLOR = "#767676";

const WALK_SPEED = 4; // units per second
const GREETING_DURATION_MS = 1500;
const ARRIVE_EPSILON = 0.05;
const BOB_AMPLITUDE = 0.08;
const BOB_SPEED = 2.2;

export type LocalPhase = "idle" | "walking-to-visit" | "greeting" | "walking-back";

export function CharacterActor({
  character,
  home,
  commandsRef,
}: {
  character: Character;
  home: Vec2;
  commandsRef: React.MutableRefObject<Map<string, WalkCommand>>;
}) {
  const groupRef = useRef<Group>(null);
  const posRef = useRef<Vec2>({ x: home.x, z: home.z });
  const phaseRef = useRef<LocalPhase>("idle");
  const targetRef = useRef<Vec2>(home);
  const phaseStartedAtRef = useRef<number>(performance.now());
  const appliedCommandRef = useRef<WalkCommand | null>(null);
  const [renderPhase, setRenderPhase] = useState<LocalPhase>("idle");

  const key = `${character.agentType}/${character.agentId}`;
  const palette = PALETTE[character.agentType] ?? DEFAULT_PALETTE;

  useFrame((_, delta) => {
    const now = performance.now();
    const command = commandsRef.current.get(key);

    if (command && command !== appliedCommandRef.current) {
      appliedCommandRef.current = command;
      phaseRef.current = command.phase;
      setRenderPhase(phaseRef.current);
      targetRef.current = command.target;
      phaseStartedAtRef.current = now;
    }

    if (phaseRef.current === "walking-to-visit" || phaseRef.current === "walking-back") {
      const dx = targetRef.current.x - posRef.current.x;
      const dz = targetRef.current.z - posRef.current.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < ARRIVE_EPSILON) {
        posRef.current = { ...targetRef.current };
        if (phaseRef.current === "walking-to-visit") {
          phaseRef.current = "greeting";
          setRenderPhase(phaseRef.current);
          phaseStartedAtRef.current = now;
          const partnerKey = appliedCommandRef.current?.partnerKey;
          if (partnerKey) {
            commandsRef.current.set(partnerKey, {
              phase: "greeting",
              role: "partner",
              target: home,
              home,
              phaseStartedAt: now,
            });
          }
        } else {
          phaseRef.current = "idle";
          setRenderPhase(phaseRef.current);
          commandsRef.current.delete(key);
        }
      } else {
        const step = Math.min(WALK_SPEED * delta, distance);
        posRef.current = {
          x: posRef.current.x + (dx / distance) * step,
          z: posRef.current.z + (dz / distance) * step,
        };
      }
    } else if (phaseRef.current === "greeting") {
      if (now - phaseStartedAtRef.current >= GREETING_DURATION_MS) {
        if (appliedCommandRef.current?.role === "caller") {
          phaseRef.current = "walking-back";
          setRenderPhase(phaseRef.current);
          targetRef.current = home;
          phaseStartedAtRef.current = now;
        } else {
          phaseRef.current = "idle";
          setRenderPhase(phaseRef.current);
          commandsRef.current.delete(key);
        }
      }
    }

    if (!groupRef.current) return;
    groupRef.current.position.x = posRef.current.x;
    groupRef.current.position.z = posRef.current.z;
    const bobbing = character.active && phaseRef.current === "idle";
    groupRef.current.position.y = bobbing ? Math.sin((now / 1000) * BOB_SPEED) * BOB_AMPLITUDE : 0;
  });

  const clip = animationClipFor(character.status, renderPhase, character.active);
  const spritePalette = character.active
    ? palette
    : { body: INACTIVE_COLOR, hair: INACTIVE_COLOR, skin: INACTIVE_COLOR, pants: INACTIVE_COLOR };
  const texture = useCharacterSpriteTexture(spritePalette, clip);

  return (
    <group ref={groupRef} position={[home.x, 0, home.z]}>
      <sprite scale={[0.9, 1.25, 1]} position={[0, 0.65, 0]}>
        <spriteMaterial map={texture} transparent opacity={character.active ? 1 : 0.5} />
      </sprite>
      <StatusLabel name={key} status={character.status} active={character.active} />
    </group>
  );
}
