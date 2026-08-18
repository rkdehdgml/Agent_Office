import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";
import { drawCharacterFrame, SPRITE_HEIGHT, SPRITE_WIDTH } from "./pixelSprite";
import { CLIP_FRAMES } from "./animationClip";
import type { AnimationClip } from "./animationClip";

const FRAME_INTERVAL_MS = 220;

/**
 * Returns a live CanvasTexture for a character. Which frames it cycles
 * through, and at what pace, is driven entirely by CLIP_FRAMES[clip] —
 * a clip with a single frame (e.g. "idle") draws once and never starts
 * an interval.
 */
export function useCharacterSpriteTexture(image: HTMLImageElement, clip: AnimationClip): CanvasTexture {
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

  const stepRef = useRef(0);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const frames = CLIP_FRAMES[clip];
    stepRef.current = 0;
    drawCharacterFrame(ctx, image, frames[0]);
    texture.needsUpdate = true;

    if (frames.length <= 1) return;
    const id = setInterval(() => {
      stepRef.current = (stepRef.current + 1) % frames.length;
      drawCharacterFrame(ctx, image, frames[stepRef.current]);
      texture.needsUpdate = true;
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [image, clip, texture]);

  return texture;
}
