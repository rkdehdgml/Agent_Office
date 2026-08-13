const WALL_HEIGHT = 1.6;
const WALL_THICKNESS = 0.25;
const OUTER_COLOR = "#3c4562";
const DIVIDER_COLOR = "#57608a";

export function Walls() {
  return (
    <>
      {/* Outer perimeter: floor is 24 (x) x 16 (z), centered at origin */}
      <mesh position={[0, WALL_HEIGHT / 2, -8]}>
        <boxGeometry args={[24, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2, 8]}>
        <boxGeometry args={[24, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[-12, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>
      <mesh position={[12, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 16]} />
        <meshStandardMaterial color={OUTER_COLOR} />
      </mesh>

      {/* Column divider at x=-4 (research/dev on the left vs. planning/HQ on
          the right), split top/bottom to leave the shared corridor band
          z in [-2,2] open */}
      <mesh position={[-4, WALL_HEIGHT / 2, -5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[-4, WALL_HEIGHT / 2, 5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>

      {/* Column divider at x=4 (planning/HQ vs. design-publishing). Only the
          top segment exists — the bottom segment would sit between HQ and
          the break room, and the break room stays open on all sides */}
      <mesh position={[4, WALL_HEIGHT / 2, -5]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, 6]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>

      {/* Row divider at z=0 (top row vs. bottom row), broken into 3 short
          wall slivers so each column keeps a 4-wide doorway onto the shared
          corridor band. x in [4,12] (design-publishing/break room column) is
          left fully open — no sliver there — so the break room has no walls
          around it at all. */}
      <mesh position={[-11, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[2, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[-4, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[4, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
      <mesh position={[3, WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[2, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color={DIVIDER_COLOR} />
      </mesh>
    </>
  );
}
