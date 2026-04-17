import { useState, useEffect } from "react";

interface LinkPreviewProps {
  url: string;
}

interface PreviewData {
  title?: string;
  description?: string;
  image?: string;
  domain: string;
}

const cache = new Map<string, PreviewData | null>();

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function detectUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  return text.match(urlRegex) ?? [];
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [data, setData] = useState<PreviewData | null | undefined>(undefined);

  useEffect(() => {
    if (cache.has(url)) {
      setData(cache.get(url));
      return;
    }

    const domain = extractDomain(url);
    const placeholder: PreviewData = { domain };
    cache.set(url, placeholder);
    setData(placeholder);

    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&palette=false&audio=false&video=false&iframe=false`)
      .then((r) => r.json())
      .then((json) => {
        if (json.status === "success") {
          const preview: PreviewData = {
            title: json.data?.title,
            description: json.data?.description,
            image: json.data?.image?.url,
            domain,
          };
          cache.set(url, preview);
          setData(preview);
        }
      })
      .catch(() => {});
  }, [url]);

  if (data === undefined) return null;

  const domain = data?.domain ?? extractDomain(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-1.5 rounded-xl border border-white/8 bg-white/3 overflow-hidden hover:bg-white/5 transition-colors max-w-[280px]"
    >
      {data?.image && (
        <img
          src={data.image}
          alt=""
          className="w-full h-28 object-cover"
          loading="lazy"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
            alt=""
            className="w-3.5 h-3.5 rounded-sm"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <span className="text-green-800 text-[10px] truncate">{domain}</span>
        </div>
        {data?.title && (
          <p className="text-green-300 text-xs font-medium leading-tight line-clamp-2">{data.title}</p>
        )}
        {data?.description && (
          <p className="text-green-800 text-[10px] mt-0.5 line-clamp-2">{data.description}</p>
        )}
      </div>
    </a>
  );
}
