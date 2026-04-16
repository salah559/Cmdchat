import { useState, useEffect } from "react";
import ConversationList from "@/components/ConversationList";
import ChatArea from "@/components/ChatArea";
import { useRooms } from "@/hooks/useRooms";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ChatPage() {
  const { rooms, ensureGeneralRoom } = useRooms();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const isMobile = useIsMobile();

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

  const showSidebar = !isMobile || !showChat;
  const showChatArea = !isMobile || showChat;

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0a0a]">
      {showSidebar && (
        <div
          className="flex flex-col h-full shrink-0 overflow-hidden"
          style={{ width: isMobile ? "100%" : "clamp(280px, 320px, 360px)" }}
        >
          <ConversationList
            activeRoomId={activeRoomId}
            onSelectRoom={handleSelectRoom}
          />
        </div>
      )}

      {!isMobile && <div className="w-px bg-white/5 shrink-0" />}

      {showChatArea && (
        <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
          <ChatArea
            roomId={activeRoomId}
            onBack={() => setShowChat(false)}
            onRoomDeleted={handleRoomDeleted}
            showBack={isMobile}
          />
        </div>
      )}
    </div>
  );
}
