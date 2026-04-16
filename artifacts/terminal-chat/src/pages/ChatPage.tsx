import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import { useRooms } from "@/hooks/useRooms";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatPage() {
  const { user } = useAuth();
  const { rooms, ensureGeneralRoom } = useRooms();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    ensureGeneralRoom();
  }, []);

  useEffect(() => {
    if (!activeRoomId && rooms.length > 0) {
      const general = rooms.find((r) => r.type === "group" && r.name === "general");
      setActiveRoomId(general?.id ?? rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  const handleSelectRoom = (id: string) => {
    setActiveRoomId(id);
    setShowChat(true);
  };

  const handleBack = () => {
    setShowChat(false);
  };

  return (
    <div className="h-screen flex flex-col bg-[#050505] font-mono overflow-hidden">
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`
          absolute inset-0 md:relative md:w-64 md:shrink-0
          transition-transform duration-200 ease-in-out z-10
          ${showChat ? "-translate-x-full md:translate-x-0" : "translate-x-0"}
        `}>
          <Sidebar
            activeRoomId={activeRoomId}
            onSelectRoom={handleSelectRoom}
          />
        </div>
        <div className={`
          absolute inset-0 md:relative md:flex-1
          transition-transform duration-200 ease-in-out
          ${showChat ? "translate-x-0" : "translate-x-full md:translate-x-0"}
        `}>
          <ChatArea
            roomId={activeRoomId}
            onBack={handleBack}
          />
        </div>
      </div>
    </div>
  );
}
