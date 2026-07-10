import { describe, expect, it } from "vitest";
import {
  canConnectAccount,
  effectiveAccountLimit,
  FREE_ACCOUNTS_LIMIT,
  getTier,
  isEntitled,
  mapStripeStatus,
  PLAN_TIERS,
} from "@/lib/billing";

describe("plan tiers", () => {
  it("exposes known tiers with limits", () => {
    expect(getTier("growth")).toMatchObject({ accountsLimit: 20, seats: 5 });
    expect(getTier("nope")).toBeNull();
    expect(Object.keys(PLAN_TIERS)).toEqual(["starter", "growth", "agency"]);
  });
});

describe("mapStripeStatus", () => {
  it("maps Stripe statuses onto our enum", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("trialing");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("incomplete")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
    expect(mapStripeStatus("something_new")).toBe("canceled");
  });
});

describe("entitlement + account limits", () => {
  it("is entitled only while active or trialing", () => {
    expect(isEntitled("active")).toBe(true);
    expect(isEntitled("trialing")).toBe(true);
    expect(isEntitled("past_due")).toBe(false);
    expect(isEntitled("canceled")).toBe(false);
  });

  it("canConnectAccount respects the limit", () => {
    expect(canConnectAccount(4, 5)).toBe(true);
    expect(canConnectAccount(5, 5)).toBe(false);
    expect(canConnectAccount(6, 5)).toBe(false);
  });

  it("effectiveAccountLimit falls back to free tier without an active sub", () => {
    expect(effectiveAccountLimit(null)).toBe(FREE_ACCOUNTS_LIMIT);
    expect(effectiveAccountLimit({ status: "canceled", accountsLimit: 100 })).toBe(
      FREE_ACCOUNTS_LIMIT,
    );
    expect(effectiveAccountLimit({ status: "active", accountsLimit: 20 })).toBe(20);
    expect(effectiveAccountLimit({ status: "trialing", accountsLimit: 5 })).toBe(5);
  });
});
