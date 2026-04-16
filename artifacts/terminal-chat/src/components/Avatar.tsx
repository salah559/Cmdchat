interface AvatarProps {
  name?: string | null;
  photoURL?: string | null;
  size?: "sm" | "md" | "lg";
}

const COLORS = [
  "bg-green-900/60 text-green-400",
  "bg-emerald-900/60 text-emerald-400",
  "bg-teal-900/60 text-teal-400",
  "bg-cyan-900/60 text-cyan-400",
  "bg-sky-900/60 text-sky-400",
];

function getColor(name: string) {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return COLORS[code % COLORS.length];
}

export default function Avatar({ name, photoURL, size = "md" }: AvatarProps) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-11 h-11 text-sm";
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  const color = name ? getColor(name) : COLORS[0];

  if (photoURL) {
    return (
      <div className={`${sz} rounded-full overflow-hidden border border-green-900/50 shrink-0`}>
        <img src={photoURL} alt={name ?? ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0 border border-green-900/50 ${color}`}>
      {initial}
    </div>
  );
}
