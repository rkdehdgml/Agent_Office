export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 32;

const RIGHT_ROW_Y = 64;

/**
 * Crops one 16x32 frame out of a pixel-agents char_N.png sprite sheet
 * (112x96: 3 direction rows x 7 frames) and draws it into ctx. Only the
 * "right" direction row is used — see the Phase 1 design spec for why
 * directional facing is out of scope this pass.
 */
export function drawCharacterFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, frameIndex: number): void {
  ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
  ctx.drawImage(
    img,
    frameIndex * SPRITE_WIDTH, RIGHT_ROW_Y, SPRITE_WIDTH, SPRITE_HEIGHT,
    0, 0, SPRITE_WIDTH, SPRITE_HEIGHT,
  );
}
