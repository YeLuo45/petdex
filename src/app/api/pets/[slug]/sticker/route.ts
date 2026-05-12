// Sticker download endpoint. Returns:
//   - 240x240 animated WebP of a single pet state (default: idle)
//   - falls back to PNG for single-frame states
//
// Query params:
//   ?state=idle|waving|jumping|...   (default 'idle')
//   ?download=1                       (forces Content-Disposition: attachment)
//
// Output works as-is in WeChat (long-press → add to favorites), WhatsApp
// individual send, Discord/Slack uploads, and Telegram inline images.
// For full WhatsApp packs, see /api/pets/[slug]/wastickers.zip.

import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
import type { PetStateId } from "@/lib/pet-states";
import { renderSticker } from "@/lib/sticker-renderer";
import { isAllowedAssetUrl } from "@/lib/url-allowlist";

export const runtime = "nodejs";

const CACHE_HEADER = "public, max-age=31536000, s-maxage=31536000, immutable";

const VALID_STATES: PetStateId[] = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
];

function parseState(value: string | null): PetStateId | undefined {
  if (!value) return undefined;
  return VALID_STATES.includes(value as PetStateId)
    ? (value as PetStateId)
    : undefined;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const state = parseState(url.searchParams.get("state"));
  const isDownload = url.searchParams.get("download") === "1";

  const pet = await db.query.submittedPets.findFirst({
    where: eq(schema.submittedPets.slug, slug),
    columns: { spritesheetUrl: true, status: true, displayName: true },
  });

  if (!pet || pet.status !== "approved") {
    return new NextResponse("not found", { status: 404 });
  }

  if (!isAllowedAssetUrl(pet.spritesheetUrl)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let result: Awaited<ReturnType<typeof renderSticker>>;
  try {
    result = await renderSticker(pet.spritesheetUrl, { state });
  } catch (err) {
    const message =
      err instanceof Error && err.message.startsWith("upstream")
        ? err.message
        : "decode";
    return new NextResponse(message, {
      status: message.startsWith("upstream") ? 502 : 500,
    });
  }

  const ext = result.contentType === "image/webp" ? "webp" : "png";
  const stateSuffix = state ? `-${state}` : "";
  const filename = `${slug}${stateSuffix}-sticker.${ext}`;

  const headers: Record<string, string> = {
    "content-type": result.contentType,
    "cache-control": CACHE_HEADER,
  };
  if (isDownload) {
    headers["content-disposition"] = `attachment; filename="${filename}"`;
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers,
  });
}
