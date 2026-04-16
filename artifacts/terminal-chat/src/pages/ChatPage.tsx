import { useState, useEffect } from "react";
import ConversationList from "@/components/ConversationList";
import ChatArea from "@/components/ChatArea";
import { useRooms } from "@/hooks/useRooms";

export default function ChatPage() {
  const { rooms, ensureGeneralRoom } = useRooms();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    ensureGeneralRoom();
  }, []);

  useEffect(() => {
    if (!activeRoomId && rooms.length > 0) {
      const general = rooms.find((r) => r.type === "group" && r.name === "general");
      if (general) setActiveRoomId(general.id);
    }
  }, [rooms, activeRoomId]);

  const handleSelectRoom = (id: string) => {
    setActiveRoomId(id);
    setShowChat(true);
  };

  const handleRoomDeleted = () => {
    setActiveRoomId(null);
    setShowChat(false);
  };

  return (
    <div className="flex overflow-hidden bg-[#0a0a0a]" style={{ height: "100dvh" }}>
      {/* Conversation List */}
      <div
        className={`
          absolute inset-0 md:relative md:w-80 lg:w-96 md:shrink-0
          transition-transform duration-300 ease-in-out
          ${showChat
            ? "-translate-x-full md:translate-x-0 z-10 pointer-events-none md:pointer-events-auto"
            : "translate-x-0 z-20 pointer-events-auto"}
        `}
      >
        <ConversationList
          activeRoomId={activeRoomId}
          onSelectRoom={handleSelectRoom}
        />
      </div>

      <div className="hidden md:block w-px bg-white/5 shrink-0" />

      {/* Chat Area */}
      <div
        className={`
          absolute inset-0 md:relative md:flex-1
          transition-transform duration-300 ease-in-out
          ${showChat
            ? "translate-x-0 z-20 pointer-events-auto"
            : "translate-x-full md:translate-x-0 z-10 pointer-events-none md:pointer-events-auto"}
        `}
      >
        <ChatArea
          roomId={activeRoomId}
          onBack={() => setShowChat(false)}
          onRoomDeleted={handleRoomDeleted}
        />
      </div>
    </div>
  );
}
