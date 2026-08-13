import { getShadowTexture } from "./officeTextures";

export function Props() {
  return (
    <>
      <Plant position={[-11, 0, -7]} />
      <Plant position={[8, 0, 7]} />
      <WaterCooler position={[3, 0, 7]} />
      <Plant position={[11, 0, 7]} />
      <WaterCooler position={[5, 0, 4]} />
    </>
  );
}

function Shadow({ size }: { size: number }) {
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={getShadowTexture()} transparent depthWrite={false} />
    </mesh>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Shadow size={0.7} />
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.6, 8]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#3fae6a" />
      </mesh>
    </group>
  );
}

function WaterCooler({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Shadow size={0.55} />
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1, 10]} />
        <meshStandardMaterial color="#dbe6ea" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.22, 10, 10]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
