import { describe, expect, it, vi } from "vitest";
import { resolveTenantWith, type TenantResolverDeps } from "@/lib/auth";

function deps(overrides: Partial<TenantResolverDeps>): TenantResolverDeps {
  return {
    clerkEnabled: false,
    getOrgId: async () => null,
    findAgencyIdByOrg: async () => null,
    headerAgencyId: null,
    ...overrides,
  };
}

describe("resolveTenantWith", () => {
  describe("Clerk enabled", () => {
    it("maps the active org to its agency", async () => {
      const findAgencyIdByOrg = vi.fn(async (org: string) =>
        org === "org_123" ? "agency_abc" : null,
      );
      const res = await resolveTenantWith(
        deps({ clerkEnabled: true, getOrgId: async () => "org_123", findAgencyIdByOrg }),
      );
      expect(res).toEqual({ agencyId: "agency_abc" });
      expect(findAgencyIdByOrg).toHaveBeenCalledWith("org_123");
    });

    it("returns null when there is no active org", async () => {
      const res = await resolveTenantWith(
        deps({ clerkEnabled: true, getOrgId: async () => null }),
      );
      expect(res).toBeNull();
    });

    it("returns null when the org has no matching agency", async () => {
      const res = await resolveTenantWith(
        deps({
          clerkEnabled: true,
          getOrgId: async () => "org_unknown",
          findAgencyIdByOrg: async () => null,
        }),
      );
      expect(res).toBeNull();
    });

    it("ignores the header fallback entirely", async () => {
      const res = await resolveTenantWith(
        deps({
          clerkEnabled: true,
          getOrgId: async () => null,
          headerAgencyId: "agency_from_header",
        }),
      );
      expect(res).toBeNull();
    });
  });

  describe("Clerk disabled (dev fallback)", () => {
    it("uses the x-agency-id header", async () => {
      const res = await resolveTenantWith(
        deps({ clerkEnabled: false, headerAgencyId: "agency_dev" }),
      );
      expect(res).toEqual({ agencyId: "agency_dev" });
    });

    it("returns null when the header is absent", async () => {
      const res = await resolveTenantWith(deps({ clerkEnabled: false, headerAgencyId: null }));
      expect(res).toBeNull();
    });
  });
});
