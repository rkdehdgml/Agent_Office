import { Html } from "@react-three/drei";
import type { CharacterStatus } from "../officeReducer";
import { isSpeechBubbleStatus } from "./statusLabelRules";

export function StatusLabel({ name, status, active }: { name: string; status: CharacterStatus; active: boolean }) {
  if (!active) return null;
  const bubble = isSpeechBubbleStatus(status);
  return (
    <Html position={[0, 1.5, 0]} center zIndexRange={[10, 0]}>
      <div className={`office-label${bubble ? " office-label--bubble" : ""}`}>
        <div className="office-label__name">{name}</div>
        <div className="office-label__status">{status}</div>
      </div>
    </Html>
  );
}
