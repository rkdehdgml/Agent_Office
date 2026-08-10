import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Desk } from "./Desk";
import { Props } from "./Props";
import { deskSlotsFor } from "./deskLayout";
import { HQ_ROOM } from "../officeReducer";

const DEPARTMENTS = ["research-dept", "planning-dept", "dev-dept", HQ_ROOM];

export function OfficeScene() {
  return (
    <Canvas shadows={false}>
      <PerspectiveCamera makeDefault position={[14, 16, 14]} fov={35} onUpdate={(cam) => cam.lookAt(0, 0, 0)} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[18, 16]} />
        <meshStandardMaterial color="#3a2f28" />
      </mesh>
      {DEPARTMENTS.flatMap((dept) =>
        deskSlotsFor(dept).map((slot, i) => <Desk key={`desk-${dept}-${i}`} position={slot} agentType={dept} />)
      )}
      <Props />
    </Canvas>
  );
}
