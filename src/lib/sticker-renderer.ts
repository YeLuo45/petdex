// Sticker rendering for WeChat / WhatsApp / Discord export.
//
// Each pet has a 9-state spritesheet (see pet-states.ts). We slice the
// requested state's row, extract its frames, and encode an animated WebP
// at 240×240 (sticker target across most platforms; WhatsApp wants 512
// for packs but is tolerant of 240 for individual sends).
//
// WebP animated is preferred over GIF: smaller files, better alpha,
// native WhatsApp pack format. Both WeChat and Discord accept it inline.
//
// Single-frame export (the default 'idle' caller) collapses to a static
// PNG via the same pipeline by skipping the animation envelope.

import { applyPalette, GIFEncoder, quantize } from "gifenc";
import sharp from "sharp";

import { defaultPetState, type PetStateId, petStates } from "@/lib/pet-states";

const FRAME_W = 192;
const FRAME_H = 208;
// 240 is the WeChat custom sticker max + smallest common WhatsApp pack
// dimension that survives Tencent's preview crawler. 512 is the WhatsApp
// pack official spec but inflates files 4x for marginal quality gain on
// 192x208 source pixel art.
const OUT_DEFAULT = 240;
const OUT_WHATSAPP_PACK = 512;

const RESIZE_OPTS = {
  fit: "contain" as const,
  kernel: "nearest" as const,
  background: { r: 0, g: 0, b: 0, alpha: 0 },
};

export type StickerOptions = {
  state?: PetStateId;
  size?: number;
};

export type StickerOutput = {
  buffer: Buffer;
  contentType: "image/webp" | "image/png";
  isAnimated: boolean;
  frameCount: number;
};

function getStateSpec(stateId?: PetStateId) {
  if (!stateId) return defaultPetState;
  return petStates.find((s) => s.id === stateId) ?? defaultPetState;
}

async function fetchSpritesheet(spritesheetUrl: string): Promise<Buffer> {
  const res = await fetch(spritesheetUrl, { redirect: "error" });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Pull the N frames for a row out of the source sheet, each as a Buffer.
async function extractRowFrames(
  source: Buffer,
  row: number,
  frames: number,
): Promise<Buffer[]> {
  const top = row * FRAME_H;
  const out: Buffer[] = [];
  for (let i = 0; i < frames; i++) {
    const buf = await sharp(source)
      .extract({
        left: i * FRAME_W,
        top,
        width: FRAME_W,
        height: FRAME_H,
      })
      .png()
      .toBuffer();
    out.push(buf);
  }
  return out;
}

// Encode an animated WebP from N frame buffers.
//
// Sharp does not encode animated WebP from raw pixel buffers: setting
// `pages` / `pageHeight` on raw input throws `vips_image_get: field
// "n-pages" not found`, and stacking frames into a tall canvas + writing
// WebP collapses to a single static page (Animation: 0 in webpinfo).
// That bug surfaced in WhatsApp stickers showing as a vertical column of
// repeated frames after the first ship.
//
// Working pipeline:
//   1) Resize each frame to (size × size) RAW RGBA via sharp
//   2) Build an animated GIF with gifenc (pure JS, transparent palette)
//   3) Re-read the GIF with sharp({ animated: true }) — sharp DOES treat
//      animated GIF as multi-page input — and re-encode as animated WebP
//
// The intermediate GIF is throwaway. WebP output ends up animated, alpha
// preserved, and well under WhatsApp's 500KB per-sticker cap.
async function buildAnimatedWebp(
  frames: Buffer[],
  size: number,
  delayMs: number,
): Promise<Buffer> {
  const channels = 4;
  const frameByteLength = size * size * channels;

  // Step 1: resize each frame and pull raw RGBA.
  const rawFrames = await Promise.all(
    frames.map((b) =>
      sharp(b).resize(size, size, RESIZE_OPTS).ensureAlpha().raw().toBuffer(),
    ),
  );

  for (const buf of rawFrames) {
    if (buf.length !== frameByteLength) {
      throw new Error(
        `frame byte length mismatch: got ${buf.length}, expected ${frameByteLength}`,
      );
    }
  }

  // Step 2: encode an animated GIF with gifenc. We palettize per frame
  // so transparent pixels stay transparent (palette index 0).
  const gif = GIFEncoder();
  for (const buf of rawFrames) {
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const palette = quantize(u8, 256, { format: "rgba4444" });
    const indexed = applyPalette(u8, palette, "rgba4444");
    gif.writeFrame(indexed, size, size, {
      palette,
      delay: delayMs,
      transparent: true,
      transparentIndex: 0,
      dispose: 2,
    });
  }
  gif.finish();
  const gifBuf = Buffer.from(gif.bytes());

  // Step 3: re-read the GIF as multi-page and emit animated WebP.
  return await sharp(gifBuf, { animated: true })
    .webp({
      loop: 0,
      quality: 80,
      effort: 4,
    })
    .toBuffer();
}

async function buildStaticPng(frame: Buffer, size: number): Promise<Buffer> {
  return await sharp(frame)
    .resize(size, size, RESIZE_OPTS)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function renderSticker(
  spritesheetUrl: string,
  options: StickerOptions = {},
): Promise<StickerOutput> {
  const state = getStateSpec(options.state);
  const size = options.size ?? OUT_DEFAULT;

  const sheet = await fetchSpritesheet(spritesheetUrl);
  const frames = await extractRowFrames(sheet, state.row, state.frames);

  // Animated WebP if >1 frame (true for every pet state — even 4-frame
  // 'waving'). Single-frame fallback is here for safety; no pet state
  // currently has frames === 1.
  if (frames.length <= 1) {
    return {
      buffer: await buildStaticPng(frames[0], size),
      contentType: "image/png",
      isAnimated: false,
      frameCount: 1,
    };
  }

  const delayMs = Math.round(state.durationMs / state.frames);
  const buffer = await buildAnimatedWebp(frames, size, delayMs);
  return {
    buffer,
    contentType: "image/webp",
    isAnimated: true,
    frameCount: state.frames,
  };
}

export const STICKER_SIZES = {
  default: OUT_DEFAULT,
  whatsappPack: OUT_WHATSAPP_PACK,
};
