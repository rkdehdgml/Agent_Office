export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 22;

export interface CharacterPalette {
  body: string;
  hair: string;
  skin: string;
  pants: string;
}

/**
 * Two walk frames (legs alternate) plus a static idle/read/type/alert pose
 * (frame 0) are enough for the current animation set — see animationClip.ts.
 */
export function drawCharacterFrame(ctx: CanvasRenderingContext2D, palette: CharacterPalette, frame: 0 | 1): void {
  ctx.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT);
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  px(4, 0, 8, 2, palette.hair);
  px(5, 2, 6, 4, palette.skin);
  px(3, 6, 10, 8, palette.body);
  const armSwing = frame === 1 ? 1 : 0;
  px(1, 7 + armSwing, 2, 6, palette.skin);
  px(13, 7 + (1 - armSwing), 2, 6, palette.skin);
  if (frame === 0) {
    px(4, 14, 3, 7, palette.pants);
    px(9, 14, 3, 7, palette.pants);
  } else {
    px(3, 14, 3, 8, palette.pants);
    px(10, 14, 3, 6, palette.pants);
  }
}
