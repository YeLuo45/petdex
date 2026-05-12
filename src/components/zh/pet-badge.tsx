"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "hot" | "new" | "limited" | "verified" | "top-creator";
type BadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface PetBadgeProps {
  variant: BadgeVariant;
  position?: BadgePosition;
  className?: string;
}

const VARIANT_STYLES: Record<
  BadgeVariant,
  { bg: string; text: string; label: string }
> = {
  hot: { bg: "bg-red-500", text: "text-white", label: "🔥 热门 HOT" },
  new: { bg: "bg-amber-500", text: "text-[#0a0e1f]", label: "✨ 新 NEW" },
  limited: {
    bg: "bg-purple-500",
    text: "text-white",
    label: "💎 限定 LIMITED",
  },
  verified: { bg: "bg-blue-500", text: "text-white", label: "✓" },
  "top-creator": { bg: "bg-yellow-400", text: "text-[#0a0e1f]", label: "⭐" },
};

const POSITION_STYLES: Record<BadgePosition, string> = {
  "top-left": "absolute top-1 left-1",
  "top-right": "absolute top-1 right-1",
  "bottom-left": "absolute bottom-1 left-1",
  "bottom-right": "absolute bottom-1 right-1",
};

export function PetBadge({
  variant,
  position = "top-left",
  className,
}: PetBadgeProps) {
  const { bg, text, label } = VARIANT_STYLES[variant];
  const isSmall = variant === "verified" || variant === "top-creator";

  return (
    <span
      className={cn(
        POSITION_STYLES[position],
        bg,
        text,
        "font-bold rounded-md shadow-sm leading-none",
        isSmall ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5",
        className,
      )}
    >
      {label}
    </span>
  );
}
