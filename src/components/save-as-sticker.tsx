"use client";

import { useEffect, useRef, useState } from "react";

import {
  Check,
  Copy,
  Download,
  Film,
  Info,
  Package,
  Play,
  Sticker,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { WeChatIcon, WhatsAppIcon } from "@/components/icons/wechat-icon";

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
  const stickerGif = `/api/pets/${slug}/sticker?format=gif`;
  const stickerPng = `/api/pets/${slug}/sticker?format=png`;
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

  function downloadGif() {
    downloadFile(`${stickerGif}&download=1`, `${slug}-sticker.gif`);
  }

  function downloadStaticPng() {
    downloadFile(`${stickerPng}&download=1`, `${slug}-sticker.png`);
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

  // Sibling-shape (h-10 rounded-full px-4) + sibling-tier height so the
  // trigger sits flush in the row with Share / Report. Filled green CTA
  // tuned per mode for contrast:
  //   - light mode: WhatsApp/WeChat brand green (vivid, white text reads
  //     cleanly on it like the official apps)
  //   - dark mode:  deeper saturated green so the chip doesn't burn next
  //     to the surrounding dark navy surface
  // White icon + white label keep AA contrast in both. The platform-brand
  // logo on the left is the disambiguator (WeChat on zh, WhatsApp on en/es).
  const ctaClasses = isZh
    ? "bg-[#07C160] hover:bg-[#06ae56] dark:bg-[#0a7d4d] dark:hover:bg-[#0c8c57]"
    : "bg-[#25D366] hover:bg-[#1EBE5D] dark:bg-[#168649] dark:hover:bg-[#1c9a55]";

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-white shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 ${ctaClasses}`}
      >
        {isZh ? (
          <WeChatIcon className="w-4 h-4 text-white" />
        ) : (
          <WhatsAppIcon className="w-4 h-4 text-white" />
        )}
        {t("ctaShort")}
      </button>

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
            onClick={downloadGif}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors border-t border-border/40"
          >
            {status === "working" ? (
              <Film className="w-4 h-4 animate-pulse text-purple-400" />
            ) : (
              <Film className="w-4 h-4 text-purple-400" />
            )}
            <div className="flex-1">
              <div className="font-medium">{t("downloadGif")}</div>
              <div className="text-xs text-muted-foreground">
                {t("downloadGifDesc")}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={downloadPack}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors border-t border-border/40"
          >
            {status === "working" ? (
              <Package className="w-4 h-4 animate-pulse text-[#25D366]" />
            ) : status === "done" ? (
              <Check className="w-4 h-4 text-[#25D366]" />
            ) : (
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
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
            onClick={downloadStaticPng}
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

          <div className="px-3 py-2 mt-1 border-t border-border text-[11px] text-muted-foreground space-y-1.5">
            {isZh && (
              <div className="flex items-start gap-2">
                <WeChatIcon className="w-3 h-3 mt-0.5 text-[#07C160] shrink-0" />
                <span>{t("howToWeChat")}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <WhatsAppIcon className="w-3 h-3 mt-0.5 text-[#25D366] shrink-0" />
              <span>{t("howToWhatsApp")}</span>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
              <span>{t("desktopNote")}</span>
            </div>
          </div>
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
