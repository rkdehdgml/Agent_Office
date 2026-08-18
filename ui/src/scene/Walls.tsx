import { useMemo } from "react";
import { WALL_GRID, getWallTileTexture, listWallCells } from "./wallTiles";

const WALL_HEIGHT = 1.6;

export function Walls() {
  const cells = useMemo(() => listWallCells(WALL_GRID), []);

  return (
    <>
      {cells.map(({ gx, gz, mask }) => (
        <mesh key={`${gx},${gz}`} position={[gx - 11.5, WALL_HEIGHT / 2, gz - 7.5]}>
          <boxGeometry args={[1, WALL_HEIGHT, 1]} />
          <meshStandardMaterial map={getWallTileTexture(mask)} />
        </mesh>
      ))}
    </>
  );
}
