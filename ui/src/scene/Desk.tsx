import { HQ_ROOM } from "../officeReducer";
import type { Vec2 } from "./deskLayout";

const DEPARTMENT_COLOR: Record<string, string> = {
  "research-dept": "#3d7ea6",
  "planning-dept": "#8a5cc2",
  "dev-dept": "#3fae6a",
  [HQ_ROOM]: "#b08d57",
};
const DEFAULT_COLOR = "#8a8a8a";

export function Desk({ position, agentType }: { position: Vec2; agentType: string }) {
  const color = DEPARTMENT_COLOR[agentType] ?? DEFAULT_COLOR;
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.2, 0.5, 0.8]} />
        <meshStandardMaterial color="#5a4632" />
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
