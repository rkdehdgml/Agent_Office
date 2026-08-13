import { HQ_ROOM } from "../officeReducer";
import type { Vec2 } from "./deskLayout";
import { getDeskTopTexture, getShadowTexture } from "./officeTextures";

const DEPARTMENT_COLOR: Record<string, string> = {
  "research-dept": "#3d7ea6",
  "planning-dept": "#8a5cc2",
  "dev-dept": "#3fae6a",
  "design-publishing-dept": "#c2547e",
  [HQ_ROOM]: "#b08d57",
};
const DEFAULT_COLOR = "#8a8a8a";

export function Desk({ position, agentType }: { position: Vec2; agentType: string }) {
  const color = DEPARTMENT_COLOR[agentType] ?? DEFAULT_COLOR;
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshBasicMaterial map={getShadowTexture()} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.2, 0.5, 0.8]} />
        <meshStandardMaterial map={getDeskTopTexture()} />
      </mesh>
      <mesh position={[0, 0.65, -0.1]}>
        <boxGeometry args={[0.4, 0.3, 0.05]} />
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
      <mesh position={[0, 0.51, 0.42]}>
        <boxGeometry args={[0.3, 0.02, 0.15]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}
