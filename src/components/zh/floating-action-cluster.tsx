"use client";

import { useRouter } from "next/navigation";

import { Download, MessageCircle, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

function ClusterButton({
  onClick,
  title,
  className,
  children,
}: {
  onClick: () => void;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center",
        "bg-[#0a0e1f] border-2 border-amber-500/40 hover:border-amber-500",
        "shadow-lg shadow-black/40 transition-colors text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function FloatingActionCluster() {
  const t = useTranslations("zhChrome");
  const router = useRouter();

  function copyToClipboard(text: string, message: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    const el = document.createElement("div");
    el.textContent = message;
    el.className =
      "fixed bottom-24 right-6 z-50 bg-[#0a0e1f] border border-amber-500/40 text-white text-xs px-3 py-1.5 rounded-md shadow-lg";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  return (
    <div className="hidden sm:flex fixed bottom-6 right-6 z-40 flex-col gap-3">
      <ClusterButton
        title={t("actionInstall")}
        onClick={() =>
          copyToClipboard("npx petdex install", t("copiedInstall"))
        }
      >
        <Download className="w-5 h-5" />
      </ClusterButton>

      <ClusterButton
        title={t("actionShare")}
        onClick={() =>
          copyToClipboard(
            typeof window !== "undefined" ? window.location.href : "",
            t("copiedLink"),
          )
        }
      >
        <Share2 className="w-5 h-5" />
      </ClusterButton>

      <button
        type="button"
        title={t("actionCommunity")}
        onClick={() => router.push("/zh/community")}
        className="w-12 h-12 rounded-full flex items-center justify-center bg-green-600 border-2 border-green-400 hover:border-green-300 shadow-lg shadow-black/40 transition-colors text-white"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    </div>
  );
}
