export function Props() {
  return (
    <>
      <Plant position={[-8, 0, -7]} />
      <Plant position={[8, 0, 7]} />
      <WaterCooler position={[0, 0, 6.5]} />
    </>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
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
