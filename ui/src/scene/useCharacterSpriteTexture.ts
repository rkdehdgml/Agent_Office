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

  useEffect(() => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const frames = CLIP_FRAMES[clip];
    let step = 0;

    const drawCurrentFrame = () => {
      drawCharacterFrame(ctx, image, frames[step]);
      texture.needsUpdate = true;
    };

    drawCurrentFrame();

    // `image` (from characterImageFor()) loads asynchronously, so the draw
    // above can run before it has decoded — leaving the canvas blank. Redraw
    // once loading finishes so the sprite always ends up visible, even for
    // single-frame clips (e.g. "idle") that never start an interval below.
    if (!image.complete) {
      image.addEventListener("load", drawCurrentFrame);
    }

    if (frames.length <= 1) {
      return () => image.removeEventListener("load", drawCurrentFrame);
    }
    const id = setInterval(() => {
      step = (step + 1) % frames.length;
      drawCurrentFrame();
    }, FRAME_INTERVAL_MS);
    return () => {
      clearInterval(id);
      image.removeEventListener("load", drawCurrentFrame);
    };
  }, [image, clip, texture]);

  return texture;
}
