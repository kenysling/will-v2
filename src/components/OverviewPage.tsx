import React, { useState } from "react";
import { ArrowRight, Check, Play } from "lucide-react";
import { MEMBERSHIP_PLANS, PLAN_ORDER } from "../data/plans";
import { AppView, BillingCycle, MembershipTierId } from "../types/estate";

interface OverviewPageProps {
  currentTierId: MembershipTierId;
  showVideo: boolean;
  onMainCtaClick: () => void;
  onNavigate: (view: AppView) => void;
  onSelectPlan: (tierId: MembershipTierId, cycle: BillingCycle) => void;
  onLoadSampleAndOpenBuilder: () => void;
}

const YOUTUBE_VIDEO_ID = "Y1g7mebf4tE";
const YOUTUBE_EMBED_URL =
  "https://www.youtube.com/embed/Y1g7mebf4tE?si=ceqGBlPbMscE80h3&autoplay=1";
const THUMBNAIL_SOURCES = [
  `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg`,
  `https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/hqdefault.jpg`,
  "/src/assets/images/hero_singapore_estate_1795157604942.jpg",
];

const CORE_PLAN_POINTS: Record<MembershipTierId, string[]> = {
  essential: [
    "Guided Singapore Will Builder (2 drafts)",
    "5 AI Estate Counsel questions / month",
    "Asset Vault (up to 5 assets) & Intestate simulator",
  ],
  family_guard: [
    "Unlimited Will revisions & Mirror Will clauses",
    "AI Risk & Ambiguity Audit + 100 Counsel queries / mo",
    "Testamentary trusts, unlimited vault & clean print export",
  ],
  private_wealth: [
    "Everything in Family Guard + unlimited Counsel",
    "Business succession & overseas estate schedules",
    "1 annual Singapore Advocate & Solicitor review credit",
  ],
};

export const OverviewPage: React.FC<OverviewPageProps> = ({
  currentTierId,
  showVideo,
  onMainCtaClick,
  onNavigate,
  onSelectPlan,
  onLoadSampleAndOpenBuilder,
}) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [thumbIndex, setThumbIndex] = useState(0);

  return (
    <div className="bg-[#F8F9FA]">
      {/* 1. Focused Hero — Identical in A & B except the video element shown only in B */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-10 pb-14 lg:pt-14 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div
            className={`${
              showVideo ? "lg:col-span-6" : "lg:col-span-8"
            } flex flex-col justify-center`}
          >
            <p className="text-xs font-medium text-[#475569] mb-3">
              Singapore Wills Act (Cap. 352) Aligned
            </p>
            <h1
              className="font-display font-semibold text-[#111827] tracking-tight leading-[1.08] max-w-xl"
              style={{
                fontSize: "clamp(2.35rem, 4vw, 3.5rem)",
                textWrap: "balance",
              }}
            >
              Draft your Singapore will with AI guidance in minutes.
            </h1>
            <p className="text-base text-[#475569] leading-relaxed mt-5 max-w-lg">
              Build formal clauses, check CPF and property boundaries, and print a signing-ready
              will with clear execution steps.
            </p>

            <div className="flex flex-wrap items-center gap-5 mt-8">
              <button
                type="button"
                onClick={onMainCtaClick}
                className="animate-cta-flash inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-md shadow-md shadow-[#1D4ED8]/25 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
              >
                Build your will NOW for FREE!
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onLoadSampleAndOpenBuilder}
                className="text-sm font-medium text-[#111827] hover:text-[#0F4C3A] underline underline-offset-4 decoration-[#CBD5E1] hover:decoration-[#0F4C3A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Try sample family
              </button>
            </div>
          </div>

          {showVideo && (
            <div className="lg:col-span-6 flex items-center">
              <div className="w-full aspect-video rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#111827] relative shadow-sm">
                {isPlayingVideo ? (
                  <iframe
                    className="w-full h-full"
                    src={YOUTUBE_EMBED_URL}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPlayingVideo(true)}
                    aria-label="Play estate planning overview video"
                    className="w-full h-full relative block group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F4C3A]"
                  >
                    <img
                      src={THUMBNAIL_SOURCES[thumbIndex]}
                      alt="Video preview thumbnail for Singapore Will Planning Overview"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        if (thumbIndex < THUMBNAIL_SOURCES.length - 1) {
                          setThumbIndex((i) => i + 1);
                        }
                      }}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10 transition-opacity duration-200 group-hover:via-black/20"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                      <span className="w-16 h-16 rounded-full bg-white text-[#111827] group-hover:bg-[#1D4ED8] group-hover:text-white flex items-center justify-center shadow-lg transition-colors duration-150">
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      </span>
                      <span className="text-sm font-medium text-white tracking-tight">
                        Watch Video Overview
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Minimal 3-Tool Quick Strip */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 border-t border-b border-[#E2E8F0] bg-white">
          <button
            type="button"
            onClick={() => onNavigate("builder")}
            className="p-5 text-left border-b sm:border-b-0 sm:border-r border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
          >
            <p className="text-sm font-semibold text-[#111827] group-hover:text-[#0F4C3A]">
              01. Will Builder →
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              6-step clauses, AI draft &amp; Section 6 checklist
            </p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("counsel")}
            className="p-5 text-left border-b sm:border-b-0 sm:border-r border-[#E2E8F0] hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
          >
            <p className="text-sm font-semibold text-[#111827] group-hover:text-[#0F4C3A]">
              02. AI Estate Counsel →
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Instant answers on CPF, HDB tenancy &amp; LPA
            </p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("vault")}
            className="p-5 text-left hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
          >
            <p className="text-sm font-semibold text-[#111827] group-hover:text-[#0F4C3A]">
              03. Asset Vault →
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Will vs. nominated estate &amp; intestate simulator
            </p>
          </button>
        </div>
      </section>

      {/* 2. Simple Membership Tiers */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14 border-t border-[#E2E8F0]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111827] tracking-tight">
              Simple Membership Plans
            </h2>
            <p className="text-sm text-[#475569] mt-1">
              Start free or try any paid plan free for 14 days — no card required today.
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-[#E2E8F0]/70 rounded-md self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                billingCycle === "monthly"
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-[#475569] hover:text-[#111827]"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                billingCycle === "annual"
                  ? "bg-white text-[#111827] shadow-xs"
                  : "text-[#475569] hover:text-[#111827]"
              }`}
            >
              Annual · Save 20%
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PLAN_ORDER.map((tierId) => {
            const plan = MEMBERSHIP_PLANS[tierId];
            const isCurrent = currentTierId === tierId;
            const displayPrice =
              billingCycle === "annual"
                ? Math.round(plan.annualPriceSgd / 12)
                : plan.monthlyPriceSgd;

            return (
              <div
                key={tierId}
                className={`bg-white rounded-lg p-6 flex flex-col justify-between border ${
                  plan.highlight
                    ? "border-[#0F4C3A] ring-1 ring-[#0F4C3A]/15"
                    : "border-[#E2E8F0]"
                }`}
              >
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold text-[#111827]">
                      {plan.name}
                    </h3>
                    {plan.highlight && (
                      <span className="text-xs font-medium text-[#0F4C3A]">Popular</span>
                    )}
                  </div>

                  <div className="mt-4 pb-5 border-b border-[#E2E8F0] flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-semibold text-[#111827] tabular-nums">
                      {plan.monthlyPriceSgd === 0 ? "S$0" : `S$${displayPrice}`}
                    </span>
                    <span className="text-xs text-[#64748B]">
                      {plan.monthlyPriceSgd === 0
                        ? "/ free forever"
                        : billingCycle === "annual"
                        ? `/ mo · S$${plan.annualPriceSgd}/yr`
                        : "/ month"}
                    </span>
                  </div>

                  <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
                    {CORE_PLAN_POINTS[tierId].map((point) => (
                      <li key={point} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-[#0F4C3A] shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={() => onSelectPlan(tierId, billingCycle)}
                    disabled={isCurrent}
                    className={`w-full py-2.5 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? "bg-[#F1F5F9] text-[#64748B] cursor-default"
                        : plan.highlight
                        ? "bg-[#0F4C3A] text-white hover:bg-[#0A3629] cursor-pointer"
                        : "bg-white text-[#111827] border border-[#CBD5E1] hover:border-[#111827] cursor-pointer"
                    }`}
                  >
                    {isCurrent
                      ? "Current Plan"
                      : plan.monthlyPriceSgd === 0
                      ? "Use Free Plan"
                      : "Start 14-Day Free Trial"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quiet Single-Line Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#64748B]">
          <span>
            LegacyDraft provides AI-assisted Singapore estate preparation and is not a law practice.
          </span>
          <span className="whitespace-nowrap shrink-0">© 2026 LegacyDraft · Singapore</span>
        </div>
      </footer>
    </div>
  );
};
