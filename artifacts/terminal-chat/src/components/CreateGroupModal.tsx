import { useState } from "react";
import { useRooms } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export default function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const { user } = useAuth();
  const { createGroup } = useRooms();
  const users = useUsers();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const otherUsers = users.filter((u) => u.uid !== user?.uid);

  const toggle = (uid: string) => {
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const handleCreate = async () => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!trimmed) { setError("Channel name is required"); return; }
    if (trimmed.length < 2) { setError("Name must be at least 2 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const roomId = await createGroup(trimmed, selected);
      onCreated(roomId);
    } catch {
      setError("Failed to create channel. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 font-mono" onClick={onClose}>
      <div
        className="w-full max-w-md border border-green-700 bg-black p-0 shadow-[0_0_40px_rgba(0,255,0,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-green-900 px-4 py-2 flex items-center justify-between">
          <span className="text-green-500 text-xs uppercase tracking-widest">Create Channel</span>
          <button onClick={onClose} className="text-green-800 hover:text-red-500 text-xs transition-colors">[X]</button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-green-700 text-xs mb-1">
              <span className="text-green-600">root@termchat:~$</span> channel --name
            </div>
            <div className="flex items-center gap-2 border border-green-900 px-3 py-2">
              <span className="text-green-700 text-sm">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="channel-name"
                autoFocus
                className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900 text-sm caret-green-400"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }}
              />
            </div>
          </div>

          {otherUsers.length > 0 && (
            <div>
              <div className="text-green-700 text-xs mb-2">Add members (optional)</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {otherUsers.map((u) => (
                  <button
                    key={u.uid}
                    onClick={() => toggle(u.uid)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                      selected.includes(u.uid)
                        ? "bg-green-900/40 text-green-300"
                        : "text-green-700 hover:bg-green-950/50 hover:text-green-400"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.status === "online" ? "bg-green-500" : "bg-green-900"}`}></span>
                    <span className="flex-1 truncate">{u.displayName}</span>
                    <span className="text-green-800 text-xs">{selected.includes(u.uid) ? "[✓]" : "[ ]"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className="text-red-500 text-xs">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 border border-green-700 text-green-400 hover:bg-green-900/30 text-sm py-2 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "[ Create Channel ]"}
            </button>
            <button
              onClick={onClose}
              className="border border-green-900 text-green-800 hover:text-green-600 text-sm px-4 py-2 transition-colors"
            >
              [Cancel]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
