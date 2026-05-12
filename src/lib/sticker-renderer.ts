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

// Stack frames vertically into a single tall image, then sharp re-reads
// it as a multi-page input by setting pageHeight. This is the documented
// path for producing animated WebP from arbitrary frame buffers via sharp
// without a separate gif/webp encoder dependency.
async function buildAnimatedWebp(
  frames: Buffer[],
  size: number,
  delayMs: number,
): Promise<Buffer> {
  // Resize each frame to target size first. Without this the composite
  // uses the source 192x208 cells and the encoder pads each page weirdly.
  const resized = await Promise.all(
    frames.map((b) =>
      sharp(b).resize(size, size, RESIZE_OPTS).png().toBuffer(),
    ),
  );
  const resizedComposites = resized.map((input, i) => ({
    input,
    top: i * size,
    left: 0,
  }));

  const stacked = await sharp({
    create: {
      width: size,
      height: size * frames.length,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(resizedComposites)
    .png()
    .toBuffer();

  // sharp does accept pageHeight at the input options level even though the
  // public types only declare it on Raw. Cast to keep tsc happy without
  // muddying the call site with @ts-expect-error.
  const animInput = sharp(stacked, {
    pages: -1,
    pageHeight: size,
  } as sharp.SharpOptions & { pageHeight?: number });

  return await animInput
    .webp({
      loop: 0,
      delay: delayMs,
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
