import type { Platform } from "@prisma/client";
import { MetaAdapter } from "./meta";
import { XAdapter } from "./x";
import { LinkedInAdapter } from "./linkedin";
import type { PlatformAdapter } from "./types";

export * from "./types";

/**
 * Registry mapping each Platform enum value to its adapter instance.
 * Meta (facebook/instagram), X, and LinkedIn are wired; TikTok and Google
 * Business follow as their adapters land (see docs/roadmap.md).
 */
const meta = new MetaAdapter();

const registry: Partial<Record<Platform, PlatformAdapter>> = {
  facebook: meta,
  instagram: meta,
  x: new XAdapter(),
  linkedin: new LinkedInAdapter(),
};

/** Get the adapter for a platform, or throw if none is registered yet. */
export function getAdapter(platform: Platform): PlatformAdapter {
  const adapter = registry[platform];
  if (!adapter) {
    throw new Error(`No PlatformAdapter registered for platform: ${platform}`);
  }
  return adapter;
}

/** Platforms that currently have a working adapter registered. */
export function supportedPlatforms(): Platform[] {
  return Object.keys(registry) as Platform[];
}
