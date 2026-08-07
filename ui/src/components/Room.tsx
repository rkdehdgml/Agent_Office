import type { Room as RoomModel } from "../officeReducer";
import { CharacterView } from "./Character";

const ROOM_ICONS: Record<string, string> = {
  "본부": "🏢",
  "research-dept": "🔬",
  "planning-dept": "📐",
  "dev-dept": "💻",
};

export function RoomView({ room }: { room: RoomModel }) {
  const icon = ROOM_ICONS[room.agentType] ?? "🏠";
  const characters = Object.values(room.characters);
  return (
    <div className="room-card">
      <div className="room-title">{icon} {room.agentType.toUpperCase()}</div>
      <div className="room-floor">
        {characters.length === 0 ? (
          <div className="room-empty">비어 있음</div>
        ) : (
          characters.map((c) => <CharacterView key={c.agentId} character={c} />)
        )}
      </div>
    </div>
  );
}
