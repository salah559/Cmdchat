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

  return (
    <div className="h-screen h-svh flex overflow-hidden bg-[#0a0a0a]">
      {/* Conversation List — always visible on lg, slide on mobile */}
      <div className={`
        absolute inset-0 lg:relative lg:w-80 lg:shrink-0 z-20
        transition-transform duration-300 ease-in-out
        ${showChat ? "-translate-x-full lg:translate-x-0" : "translate-x-0"}
      `}>
        <ConversationList
          activeRoomId={activeRoomId}
          onSelectRoom={handleSelectRoom}
        />
      </div>

      {/* Divider on desktop */}
      <div className="hidden lg:block w-px bg-white/5 shrink-0"></div>

      {/* Chat Area */}
      <div className={`
        absolute inset-0 lg:relative lg:flex-1
        transition-transform duration-300 ease-in-out
        ${showChat ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `}>
        <ChatArea
          roomId={showChat || window.innerWidth >= 1024 ? activeRoomId : null}
          onBack={() => setShowChat(false)}
        />
      </div>
    </div>
  );
}
