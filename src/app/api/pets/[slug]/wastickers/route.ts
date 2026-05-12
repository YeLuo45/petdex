// WhatsApp Sticker Pack download for a single pet.
//
// Returns a ZIP containing 9 animated WebP stickers (one per pet state)
// + a tray icon + manifest.json compliant with the WhatsApp Sticker
// Maker SDK contract. Users open this on Android via 'Sticker Maker for
// WhatsApp' or similar third-party apps; iOS supports it through
// 'Sticker Maker Studio'. The pack identifier is namespaced to the pet.
//
// Spec reference (WhatsApp public sample):
//   https://github.com/WhatsApp/stickers/tree/main/Android
//
// We send the manifest as 'contents.json' at the ZIP root; sticker apps
// look for either name. Stickers are 512x512 animated WebP, ≤500KB each.
// Pack metadata advertises petdex.crafter.run as publisher website so the
// brand surfaces inside the user's sticker library.

import { NextResponse } from "next/server";

import { eq } from "drizzle-orm";
import JSZip from "jszip";
import sharp from "sharp";

import { db, schema } from "@/lib/db/client";
import { petStates } from "@/lib/pet-states";
import { renderSticker, STICKER_SIZES } from "@/lib/sticker-renderer";
import { isAllowedAssetUrl } from "@/lib/url-allowlist";

export const runtime = "nodejs";

const CACHE_HEADER = "public, max-age=86400, s-maxage=604800";
const PUBLISHER = "Petdex";
const PUBLISHER_WEBSITE = "https://petdex.crafter.run";
const PUBLISHER_EMAIL = "hello@crafter.run";
// Apple iMessage / WhatsApp iOS share the same identifier namespace.
// We prefix with 'petdex.' to avoid collisions with other apps using
// the same pet slug.
function packIdentifier(slug: string) {
  return `petdex.${slug}`;
}

async function buildTrayIcon(spritesheetUrl: string): Promise<Buffer> {
  // 96x96 PNG, ≤50KB. We use the first idle frame, downscale with
  // nearest-neighbor to preserve pixel art crispness.
  const res = await fetch(spritesheetUrl, { redirect: "error" });
  if (!res.ok) throw new Error("upstream");
  const sheet = Buffer.from(await res.arrayBuffer());
  return await sharp(sheet)
    .extract({ left: 0, top: 0, width: 192, height: 208 })
    .resize(96, 96, {
      fit: "contain",
      kernel: "nearest",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;

  const pet = await db.query.submittedPets.findFirst({
    where: eq(schema.submittedPets.slug, slug),
    columns: {
      spritesheetUrl: true,
      status: true,
      displayName: true,
      description: true,
    },
  });

  if (!pet || pet.status !== "approved") {
    return new NextResponse("not found", { status: 404 });
  }

  if (!isAllowedAssetUrl(pet.spritesheetUrl)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let trayBuf: Buffer;
  let stickerBufs: Array<{ id: string; label: string; buf: Buffer }>;
  try {
    trayBuf = await buildTrayIcon(pet.spritesheetUrl);
    stickerBufs = await Promise.all(
      petStates.map(async (state) => {
        const out = await renderSticker(pet.spritesheetUrl, {
          state: state.id,
          size: STICKER_SIZES.whatsappPack,
        });
        return { id: state.id, label: state.label, buf: out.buffer };
      }),
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("upstream")
        ? "upstream"
        : "decode";
    return new NextResponse(msg, { status: msg === "upstream" ? 502 : 500 });
  }

  // Manifest format mirrors the WhatsApp public sample. Emoji array maps
  // each sticker to up to 3 emoji that hint mood. We pick conservative
  // defaults per state — users can re-tag inside the sticker maker app.
  const stateEmoji: Record<string, string[]> = {
    idle: ["😊"],
    "running-right": ["🏃"],
    "running-left": ["🏃"],
    waving: ["👋"],
    jumping: ["🤸"],
    failed: ["😅"],
    waiting: ["⏳"],
    running: ["🏃"],
    review: ["🤔"],
  };

  const manifest = {
    identifier: packIdentifier(slug),
    name: `${pet.displayName} · Petdex`,
    publisher: PUBLISHER,
    tray_image_file: "tray.png",
    publisher_email: PUBLISHER_EMAIL,
    publisher_website: PUBLISHER_WEBSITE,
    privacy_policy_website: `${PUBLISHER_WEBSITE}/legal/privacy`,
    license_agreement_website: `${PUBLISHER_WEBSITE}/legal/terms`,
    image_data_version: "1",
    avoid_cache: false,
    animated_sticker_pack: true,
    stickers: stickerBufs.map((s) => ({
      image_file: `${s.id}.webp`,
      emojis: stateEmoji[s.id] ?? ["🐾"],
    })),
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("contents.json", JSON.stringify(manifest, null, 2));
  zip.file("tray.png", trayBuf);
  for (const s of stickerBufs) {
    zip.file(`${s.id}.webp`, s.buf);
  }

  const zipBuf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new NextResponse(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slug}-petdex-stickers.zip"`,
      "cache-control": CACHE_HEADER,
      "x-petdex-pack-id": packIdentifier(slug),
      "x-petdex-pack-stickers": String(stickerBufs.length),
    },
  });
}
