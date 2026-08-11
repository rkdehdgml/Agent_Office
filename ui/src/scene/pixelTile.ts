export const TILE_SIZE = 16;

export function drawFloorTile(ctx: CanvasRenderingContext2D, evenCell: boolean): void {
  ctx.fillStyle = evenCell ? "#3a2f28" : "#342a24";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, TILE_SIZE - 2, TILE_SIZE, 2);
}

export function drawDeskTopTile(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#5a4632";
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = "#6b5540";
  for (let x = 0; x < TILE_SIZE; x += 4) {
    ctx.fillRect(x, 0, 2, TILE_SIZE);
  }
}
