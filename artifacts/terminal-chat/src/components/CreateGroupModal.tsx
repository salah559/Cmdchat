import { useState } from "react";
import { useRooms } from "@/hooks/useRooms";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "./Avatar";

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full"></div>
        </div>

        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-green-300 font-semibold text-base">New Channel</h2>
          <button onClick={onClose} className="text-green-900 hover:text-green-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-green-800 text-xs uppercase tracking-wider mb-2 block">Channel Name</label>
            <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-4 py-3 focus-within:border-green-800 transition-colors">
              <span className="text-green-700 font-mono">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="channel-name"
                autoFocus
                className="flex-1 bg-transparent outline-none text-green-300 placeholder-green-900 text-sm caret-green-400 font-mono"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }}
              />
            </div>
          </div>

          {otherUsers.length > 0 && (
            <div>
              <label className="text-green-800 text-xs uppercase tracking-wider mb-2 block">
                Add Members <span className="normal-case">(optional)</span>
                {selected.length > 0 && <span className="text-green-600 ml-2">{selected.length} selected</span>}
              </label>
              <div className="space-y-1 max-h-44 overflow-y-auto -mx-1 px-1">
                {otherUsers.map((u) => {
                  const isSelected = selected.includes(u.uid);
                  return (
                    <button
                      key={u.uid}
                      onClick={() => toggle(u.uid)}
                      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                        isSelected ? "bg-green-900/30 border border-green-800/50" : "hover:bg-white/4 border border-transparent"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar name={u.displayName} photoURL={u.photoURL} size="sm" />
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#111] ${u.status === "online" ? "bg-green-500" : "bg-gray-700"}`}></span>
                      </div>
                      <span className={`flex-1 text-sm truncate ${isSelected ? "text-green-300" : "text-green-700"}`}>{u.displayName}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-green-600 border-green-600" : "border-green-900"}`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm px-1">{error}</div>
          )}

          <div className="flex gap-3 pt-2 pb-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-white/8 text-green-800 hover:text-green-600 text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-black font-semibold text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Channel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
