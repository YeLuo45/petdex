"use client";

import { useEffect, useRef, useState } from "react";

import { Check, Copy, Download, Package, Play, Sticker } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { WeChatIcon, WhatsAppIcon } from "@/components/icons/wechat-icon";
import { Button } from "@/components/ui/button";

type Props = {
  slug: string;
  displayName: string;
};

type Status = "idle" | "working" | "done" | "error";

export function SaveAsSticker({ slug, displayName }: Props) {
  const locale = useLocale();
  const t = useTranslations("sticker");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const isZh = locale === "zh";
  const stickerWebp = `/api/pets/${slug}/sticker`;
  const stickerPng = `/api/pets/${slug}/sticker?state=idle`;
  const wastickersUrl = `/api/pets/${slug}/wastickers`;

  function flashDone() {
    setStatus("done");
    setTimeout(() => setStatus("idle"), 2000);
    setOpen(false);
  }

  function flashError() {
    setStatus("error");
    setTimeout(() => setStatus("idle"), 2500);
  }

  function downloadFile(url: string, filename: string) {
    setStatus("working");
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      flashDone();
    } catch {
      flashError();
    }
  }

  function downloadAnimated() {
    downloadFile(`${stickerWebp}?download=1`, `${slug}-sticker.webp`);
  }

  function downloadPack() {
    downloadFile(wastickersUrl, `${slug}-petdex-stickers.zip`);
  }

  async function copyToClipboard() {
    setStatus("working");
    try {
      const res = await fetch(stickerPng);
      const blob = await res.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      flashDone();
    } catch {
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}${stickerWebp}`,
        );
        flashDone();
      } catch {
        flashError();
      }
    }
  }

  function previewSticker() {
    window.open(stickerWebp, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <Button
        type="button"
        variant={isZh ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={
          isZh
            ? "bg-green-600 hover:bg-green-700 text-white border-0 gap-2"
            : "gap-2"
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isZh ? (
          <WeChatIcon className="w-4 h-4" />
        ) : (
          <Sticker className="w-4 h-4" />
        )}
        {isZh ? t("ctaWeChat") : t("ctaGeneric")}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-30 w-80 rounded-lg border border-border bg-popover shadow-xl py-2"
        >
          <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
            {isZh ? t("hintWeChat") : t("hintGeneric")}
          </div>

          <button
            type="button"
            onClick={downloadAnimated}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
          >
            {status === "working" ? (
              <Play className="w-4 h-4 animate-pulse text-amber-400" />
            ) : status === "done" ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Play className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            )}
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                {t("downloadAnimated")}
                <span className="rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 leading-none">
                  {t("recommendedTag")}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t("downloadAnimatedDesc")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={downloadPack}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors border-t border-border/40"
          >
            {status === "working" ? (
              <Package className="w-4 h-4 animate-pulse text-green-500" />
            ) : status === "done" ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <WhatsAppIcon className="w-4 h-4 text-green-500" />
            )}
            <div className="flex-1">
              <div className="font-medium">{t("downloadPack")}</div>
              <div className="text-xs text-muted-foreground">
                {t("downloadPackDesc")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              downloadFile(`${stickerPng}&download=1`, `${slug}-sticker.png`)
            }
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors border-t border-border/40"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{t("downloadPng")}</div>
              <div className="text-xs text-muted-foreground">
                {t("downloadPngDesc")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
          >
            <Copy className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{t("copyImage")}</div>
              <div className="text-xs text-muted-foreground">
                {t("copyImageDesc")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={previewSticker}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
          >
            <Sticker className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{t("preview")}</div>
              <div className="text-xs text-muted-foreground">
                {t("previewDesc")}
              </div>
            </div>
          </button>

          {isZh && (
            <div className="px-3 py-2 mt-1 border-t border-border text-xs text-muted-foreground">
              {t("howToWeChat")}
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="absolute right-0 top-full mt-2 z-30 px-3 py-2 rounded-md bg-red-500 text-white text-xs shadow-lg">
          {t("errorGeneric")}
        </div>
      )}

      <span className="sr-only">{displayName}</span>
    </div>
  );
}
