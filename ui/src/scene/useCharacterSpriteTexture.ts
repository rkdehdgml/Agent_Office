import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";
import { drawCharacterFrame, SPRITE_HEIGHT, SPRITE_WIDTH } from "./pixelSprite";
import type { CharacterPalette } from "./pixelSprite";
import type { AnimationClip } from "./animationClip";

const WALK_FRAME_INTERVAL_MS = 220;

/**
 * Returns a live CanvasTexture for a character. Frame 0 is used for every
 * clip except "walk", which alternates 0/1 on a timer to animate legs.
 */
export function useCharacterSpriteTexture(palette: CharacterPalette, clip: AnimationClip): CanvasTexture {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!canvasRef.current) {
    const canvas = document.createElement("canvas");
    canvas.width = SPRITE_WIDTH;
    canvas.height = SPRITE_HEIGHT;
    canvasRef.current = canvas;
  }

  const texture = useMemo(() => {
    const tex = new CanvasTexture(canvasRef.current!);
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = NearestFilter;
    tex.minFilter = NearestFilter;
    return tex;
  }, []);

  const frameRef = useRef<0 | 1>(0);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    if (clip !== "walk") {
      frameRef.current = 0;
      drawCharacterFrame(ctx, palette, 0);
      texture.needsUpdate = true;
      return;
    }
    const id = setInterval(() => {
      frameRef.current = frameRef.current === 0 ? 1 : 0;
      drawCharacterFrame(ctx, palette, frameRef.current);
      texture.needsUpdate = true;
    }, WALK_FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [palette, clip, texture]);

  return texture;
}
