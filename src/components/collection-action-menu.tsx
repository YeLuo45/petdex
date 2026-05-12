"use client";

import { useEffect, useRef, useState } from "react";

import {
  Check,
  X as CloseIcon,
  Copy,
  ExternalLink,
  Layers,
  Link2,
  MoreHorizontal,
  Terminal,
} from "lucide-react";

import { CodexLogo } from "@/components/codex-logo";

const SITE_URL = "https://petdex.crafter.run";
// Cap on the install command length. Beyond this we truncate with a
// hint so the user can paste the rest manually instead of getting a
// 4 KB clipboard payload that some shells reject.
const MAX_SLUGS_IN_COMMAND = 24;

type CollectionPet = { slug: string };

type Props = {
  collection: {
    slug: string;
    title: string;
    petCount: number;
    pets: CollectionPet[];
  };
};

type Copied = "install" | "link" | null;

export function CollectionActionMenu({ collection }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<Copied>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape so the menu does not strand itself
  // when the user moves on. Same pattern as PetActionMenu.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-clear the copied affordance so a user reopening the menu later
  // does not see a stale checkmark.
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(null), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const slugs = collection.pets.map((p) => p.slug);
  const truncated = slugs.length > MAX_SLUGS_IN_COMMAND;
  const installSlugs = truncated ? slugs.slice(0, MAX_SLUGS_IN_COMMAND) : slugs;
  const installCmd = `npx petdex install ${installSlugs.join(" ")}`;
  const collectionUrl = `${SITE_URL}/collections/${collection.slug}`;
  const installHint = truncated
    ? `${installSlugs.length} of ${slugs.length} pets · paste rest manually`
    : `${slugs.length} pet${slugs.length === 1 ? "" : "s"}`;

  const copyText = async (text: string, kind: Exclude<Copied, null>) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      /* clipboard blocked: fail silent, no toast infra here */
    }
  };

  const onShareX = () => {
    const text = `${collection.title} pet collection on Petdex — install with one line`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(collectionUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper, the trigger button is the interactive role
    <div
      ref={ref}
      style={open ? { zIndex: 60 } : undefined}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${collection.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex size-8 items-center justify-center rounded-full border border-border-base bg-surface/90 text-muted-2 transition hover:border-border-strong hover:text-foreground"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-[60] mt-2 w-72 overflow-hidden rounded-2xl border border-border-base bg-surface shadow-xl shadow-blue-950/15"
        >
          <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-2 dark:border-white/[0.06]">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-muted-3 uppercase">
              <Layers className="size-3" />
              {collection.title}
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              className="grid size-6 place-items-center rounded-full text-muted-4 transition hover:bg-surface-muted hover:text-foreground"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </div>

          <ul className="py-1">
            {slugs.length > 0 ? (
              <li>
                <a
                  href={`codex://new?prompt=${encodeURIComponent(`Install this Petdex collection by running: ${installCmd}`)}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-2 transition hover:bg-surface-muted hover:text-foreground"
                >
                  <CodexLogo className="size-4" />
                  <span className="flex flex-col">
                    <span>Open in Codex</span>
                    <span className="font-mono text-[10px] tracking-tight text-muted-4">
                      Codex Desktop runs the install
                    </span>
                  </span>
                </a>
              </li>
            ) : null}
            {slugs.length > 0 ? (
              <Item
                icon={
                  copied === "install" ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Terminal className="size-4" />
                  )
                }
                label={
                  copied === "install"
                    ? "Copied install command"
                    : "Copy install all"
                }
                hint={installHint}
                onClick={() => copyText(installCmd, "install")}
              />
            ) : null}
            <Item
              icon={
                copied === "link" ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Link2 className="size-4" />
                )
              }
              label={copied === "link" ? "Copied link" : "Copy collection link"}
              hint={collectionUrl.replace(/^https?:\/\//, "")}
              onClick={() => copyText(collectionUrl, "link")}
            />
            <Item
              icon={<XIcon className="size-4" />}
              label="Share to X"
              onClick={onShareX}
            />
            <li>
              <a
                href={`/collections/${collection.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 border-t border-black/[0.06] px-3 py-2.5 text-sm text-muted-2 transition hover:bg-surface-muted hover:text-foreground dark:border-white/[0.06]"
              >
                <ExternalLink className="size-4" />
                <span className="flex-1">View collection</span>
              </a>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Item({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted-2 transition hover:bg-surface-muted hover:text-foreground"
      >
        {icon}
        <span className="flex flex-col">
          <span>{label}</span>
          {hint ? (
            <span className="font-mono text-[10px] tracking-tight text-muted-4">
              {hint}
            </span>
          ) : null}
        </span>
        {label.startsWith("Copy") ? (
          <Copy className="ml-auto size-3.5 text-stone-300 dark:text-stone-600" />
        ) : null}
      </button>
    </li>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M18.244 2H21l-6.55 7.49L22 22h-6.93l-4.83-6.31L4.6 22H1.84l7.01-8.02L1 2h7.07l4.36 5.78L18.244 2zm-2.43 18h1.91L7.27 4H5.27l10.544 16z" />
    </svg>
  );
}
