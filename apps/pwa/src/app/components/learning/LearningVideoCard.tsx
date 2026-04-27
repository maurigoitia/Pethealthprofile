import { MaterialIcon } from "../shared/MaterialIcon";
import type { LearningVideo } from "../../types/learningVideo";

interface LearningVideoCardProps {
  video: LearningVideo;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins} min`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function providerLabel(p: LearningVideo["provider"]): string {
  if (p === "youtube") return "YouTube";
  if (p === "vimeo") return "Vimeo";
  return "Web";
}

export function LearningVideoCard({ video }: LearningVideoCardProps) {
  const handleOpen = () => {
    window.open(video.url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      aria-label={`Abrir video: ${video.title}`}
      className="w-full text-left rounded-[16px] overflow-hidden bg-white border border-[#E5E7EB] hover:border-[#1A9B7D]/40 transition-colors"
      style={{ minHeight: 44 }}
    >
      {/* Thumbnail 16:9 + play overlay */}
      <div className="relative w-full aspect-[16/9] bg-[#E0F2F1] overflow-hidden">
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <span
            className="flex items-center justify-center rounded-full bg-white/95 text-[#074738]"
            style={{ width: 48, height: 48 }}
          >
            <MaterialIcon name="play_arrow" className="!text-[28px]" filled />
          </span>
        </div>
        {/* Duration chip */}
        <span
          className="absolute bottom-2 right-2 rounded-full bg-black/70 text-white text-[10px] font-bold px-2 py-0.5"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {formatDuration(video.durationSeconds)}
        </span>
      </div>

      {/* Body */}
      <div className="p-3">
        <p
          className="text-[13px] font-[800] text-[#074738] leading-snug"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {video.title}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E0F2F1] text-[#074738] text-[10px] font-bold px-2 py-0.5">
            <MaterialIcon name="smart_display" className="!text-[12px]" />
            {providerLabel(video.provider)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default LearningVideoCard;
