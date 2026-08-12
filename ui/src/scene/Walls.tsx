const WALL_HEIGHT = 1.6;
const WALL_THICKNESS = 0.25;
const OUTER_COLOR = "#1b2130";
const DIVIDER_COLOR = "#2a2f42";

export function Walls() {
  return (
    <>
      {/* Outer perimeter */}
      <mesh position={[0, WALL_HEIGHT / 2, -8]}>
        <boxGeometry args={[18, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, 8]}>
        <boxGeometry args={[18, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[-9, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[9, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>

      {/* x=0 divider (research/dev on the left vs. planning/HQ on the right),
          split around z=0 to leave the center 4x4 square open */}
      <mesh position={[0, WALL_HEIGHT / 2, -5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, 5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>

      {/* z=0 divider (research/planning on top vs. dev/HQ on the bottom),
          split around x=0 to leave the center 4x4 square open */}
      <mesh position={[-5.5, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[7, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[5.5, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[7, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
    </>
  );
}
