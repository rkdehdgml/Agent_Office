/** Fixed quarter-view camera, chosen interactively via a preview spike — see
 * docs/superpowers/specs/2026-08-12-isometric-office-camera-design.md */
export const CAMERA_TILT_DEG = 50;
export const CAMERA_AZIMUTH_DEG = 45;
export const CAMERA_RADIUS = 24;

export function cameraPositionForTilt(
  tiltDeg: number,
  azimuthDeg: number,
  radius: number
): [number, number, number] {
  const tilt = (tiltDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return [radius * Math.sin(tilt) * Math.cos(az), radius * Math.cos(tilt), radius * Math.sin(tilt) * Math.sin(az)];
}
