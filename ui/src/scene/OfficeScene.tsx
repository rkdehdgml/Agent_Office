import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { Desk } from "./Desk";
import { Props } from "./Props";
import { Walls } from "./Walls";
import { CharacterActor } from "./CharacterActor";
import { deskSlotsFor, homePositionFor, leadSlotFor } from "./deskLayout";
import { HQ_ROOM } from "../officeReducer";
import type { OfficeState } from "../officeReducer";
import type { WalkCommand } from "./useWalkerCommands";
import { getFloorTexture } from "./officeTextures";
import { CAMERA_AZIMUTH_DEG, CAMERA_TILT_DEG, cameraPositionForTilt } from "./cameraGeometry";
import { TEAM_LEAD_TYPES } from "./teamLeadCharacters";

const DEPARTMENTS = ["research-dept", "planning-dept", "dev-dept", "design-publishing-dept", HQ_ROOM];

const CAMERA_POSITION = cameraPositionForTilt(CAMERA_TILT_DEG, CAMERA_AZIMUTH_DEG, 30);

export function OfficeScene({
  state,
  commandsRef,
}: {
  state: OfficeState;
  commandsRef: React.MutableRefObject<Map<string, WalkCommand>>;
}) {
  const characters = Object.values(state.rooms).flatMap((room) => Object.values(room.characters));

  return (
    <Canvas shadows={false}>
      <OrthographicCamera makeDefault position={CAMERA_POSITION} zoom={29} onUpdate={(cam) => cam.lookAt(0, 0, 0)} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[10, 20, 10]} intensity={1.15} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 16]} />
        <meshStandardMaterial map={getFloorTexture()} />
      </mesh>
      <Walls />
      {DEPARTMENTS.flatMap((dept) =>
        deskSlotsFor(dept).map((slot, i) => <Desk key={`desk-${dept}-${i}`} position={slot} agentType={dept} />)
      )}
      <Props />
      {TEAM_LEAD_TYPES.map((agentType) => (
        <Desk key={`lead-desk-${agentType}`} position={leadSlotFor(agentType)} agentType={agentType} />
      ))}
      {TEAM_LEAD_TYPES.map((agentType) => (
        <CharacterActor
          key={`lead-${agentType}`}
          character={{
            agentId: `lead-${agentType}`,
            agentType,
            status: "출근",
            previousStatus: "출근",
            active: true,
            completedCount: 0,
          }}
          home={leadSlotFor(agentType)}
          commandsRef={commandsRef}
          isFixed
        />
      ))}
      {characters.map((character) => (
        <CharacterActor
          key={`${character.agentType}/${character.agentId}`}
          character={character}
          home={homePositionFor(state, character.agentType, character.agentId)}
          commandsRef={commandsRef}
        />
      ))}
    </Canvas>
  );
}
