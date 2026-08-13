import { describe, expect, it } from "vitest";
import { CAMERA_AZIMUTH_DEG, CAMERA_RADIUS, CAMERA_TILT_DEG, cameraPositionForTilt } from "./cameraGeometry";

describe("cameraPositionForTilt", () => {
  it("sits directly overhead when tilt is 0, regardless of azimuth", () => {
    const [x, y, z] = cameraPositionForTilt(0, 45, 10);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(10, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it("sits at ground level along the azimuth direction when tilt is 90", () => {
    const [x, y, z] = cameraPositionForTilt(90, 0, 10);
    expect(x).toBeCloseTo(10, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it("matches the confirmed office camera position (tilt 50, azimuth 45, radius 30)", () => {
    const [x, y, z] = cameraPositionForTilt(50, 45, 30);
    expect(x).toBeCloseTo(16.25, 1);
    expect(y).toBeCloseTo(19.28, 1);
    expect(z).toBeCloseTo(16.25, 1);
  });

  it("exports the confirmed constants used by the scene", () => {
    expect(CAMERA_TILT_DEG).toBe(50);
    expect(CAMERA_AZIMUTH_DEG).toBe(45);
    expect(CAMERA_RADIUS).toBe(30);
  });
});
