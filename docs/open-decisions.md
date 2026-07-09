# Open Decisions to Nail Down Before Coding

These choices materially change the data model, integrations, or hosting, so
settle them before Phase 1 code lands.

## 1. Reseller billing

Do agencies just pay us, or do we need **agency-bills-their-clients**
(Stripe Connect)? Stripe Connect adds onboarding, payout, and compliance
surface — only take it on if reseller mode is a launch requirement.

## 2. Launch platforms

Which platforms are must-have for launch vs. later?

- **Meta + LinkedIn** covers most B2B agency clients.
- Add **TikTok** if the client base skews consumer / younger.

## 3. Hosting

Self-host vs. managed hosting. If infrastructure is already run in-house,
self-hosting the production worker tier may be cheaper — but the MVP stays on
managed (Vercel + Neon) to move fast.

## 4. AI autonomy level

How much AI automation will clients trust unsupervised?

- **Recommendation for V1:** AI drafts, human sends.
- Full autonomy is a later, trust-building phase.

---

*Next step: pick Phase 1 scope and scaffold the actual repo
(Next.js + NestJS + Prisma schema + Meta adapter stub) when ready to write code.*
