import type { Platform } from "@prisma/client";
import { MetaAdapter } from "./meta";
import type { PlatformAdapter } from "./types";

export * from "./types";

/**
 * Registry mapping each Platform enum value to its adapter instance.
 * Only Meta (facebook/instagram) is wired for Phase 1; others are added as
 * their adapters land (see docs/roadmap.md).
 */
const meta = new MetaAdapter();

const registry: Partial<Record<Platform, PlatformAdapter>> = {
  facebook: meta,
  instagram: meta,
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
