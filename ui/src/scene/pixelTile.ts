export const TILE_SIZE = 16;

export function drawDeskTopTile(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#6f5940";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#7d6650";
  for (let x = 0; x < TILE_SIZE; x += 4) {
    ctx.fillRect(x, 0, 2, TILE_SIZE);
  }
}
