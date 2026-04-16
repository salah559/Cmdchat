import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import { useRooms } from "@/hooks/useRooms";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatPage() {
  const { user } = useAuth();
  const { rooms, ensureGeneralRoom } = useRooms();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    ensureGeneralRoom();
  }, []);

  useEffect(() => {
    if (!activeRoomId && rooms.length > 0) {
      const general = rooms.find((r) => r.type === "group" && r.name === "general");
      setActiveRoomId(general?.id ?? rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-black font-mono overflow-hidden">
      <div className="shrink-0 border-b border-green-900 bg-black/95 px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-700/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-700/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-600/80"></div>
          </div>
          <span className="text-green-800 text-xs">termchat — bash — 200×50</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-green-800">
          <span className="text-green-900">{time.toLocaleTimeString("en-US", { hour12: false })}</span>
          <span className="text-green-700">{user?.email}</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeRoomId={activeRoomId} onSelectRoom={setActiveRoomId} />
        <ChatArea roomId={activeRoomId} />
      </div>
    </div>
  );
}
