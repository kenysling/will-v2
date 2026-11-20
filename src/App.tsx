import { useEffect, useRef, useState } from "react";
import { variant, track, consent, setConsent, loadClarity, type Variant } from "./pt";
import { AssetVault } from "./components/AssetVault";
import { EstateCounsel } from "./components/EstateCounsel";
import { MembershipPage } from "./components/MembershipPage";
import { OverviewPage } from "./components/OverviewPage";
import { SubscriptionModal } from "./components/SubscriptionModal";
import { TopBar } from "./components/TopBar";
import { WillBuilder } from "./components/WillBuilder";
import {
  EMPTY_WILL_PROFILE,
  INITIAL_INVOICES,
  INITIAL_SUBSCRIPTION,
  MEMBERSHIP_PLANS,
  SAMPLE_VAULT_ASSETS,
  SAMPLE_WILL_PROFILE,
} from "./data/plans";
import {
  AppView,
  AuditResult,
  BillingCycle,
  CounselMessage,
  GeneratedWillResult,
  InvoiceRecord,
  MembershipTierId,
  SubscriptionState,
  VaultAsset,
  WillProfile,
} from "./types/estate";

const STORAGE_KEY = "legacydraft_sg_state_v1";

interface PersistedState {
  subscription: SubscriptionState;
  invoices: InvoiceRecord[];
  willProfile: WillProfile;
  generatedWill: GeneratedWillResult | null;
  auditResult: AuditResult | null;
  vaultAssets: VaultAsset[];
  counselMessages: CounselMessage[];
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        subscription: parsed.subscription ?? INITIAL_SUBSCRIPTION,
        invoices: parsed.invoices ?? INITIAL_INVOICES,
        willProfile: parsed.willProfile ?? EMPTY_WILL_PROFILE,
        generatedWill: parsed.generatedWill ?? null,
        auditResult: parsed.auditResult ?? null,
        vaultAssets: parsed.vaultAssets ?? SAMPLE_VAULT_ASSETS,
        counselMessages: parsed.counselMessages ?? [],
      };
    }
  } catch {
    // Ignore storage read issues and fall back to defaults
  }
  return {
    subscription: INITIAL_SUBSCRIPTION,
    invoices: INITIAL_INVOICES,
    willProfile: EMPTY_WILL_PROFILE,
    generatedWill: null,
    auditResult: null,
    vaultAssets: SAMPLE_VAULT_ASSETS,
    counselMessages: [],
  };
}

export default function App() {
  const initial = loadInitialState();

  // Read A/B variant once when the screen first renders
  const [abVariant] = useState<Variant>(() => variant());
  const [consentChoice, setConsentChoice] = useState<"granted" | "denied" | null>(() =>
    consent()
  );
  const hasTrackedScreenView = useRef(false);

  const [activeView, setActiveView] = useState<AppView>("overview");
  const [subscription, setSubscription] = useState<SubscriptionState>(initial.subscription);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(initial.invoices);
  const [willProfile, setWillProfile] = useState<WillProfile>(initial.willProfile);
  const [generatedWill, setGeneratedWill] = useState<GeneratedWillResult | null>(
    initial.generatedWill
  );
  const [auditResult, setAuditResult] = useState<AuditResult | null>(initial.auditResult);
  const [vaultAssets, setVaultAssets] = useState<VaultAsset[]>(initial.vaultAssets);
  const [counselMessages, setCounselMessages] = useState<CounselMessage[]>(
    initial.counselMessages
  );

  // Subscription Checkout Modal state
  const [checkoutModal, setCheckoutModal] = useState<{
    open: boolean;
    tierId: MembershipTierId;
    cycle: BillingCycle;
  }>({
    open: false,
    tierId: "family_guard",
    cycle: "annual",
  });

  // On app start: load Clarity if consent is already granted, and record screen_view once
  useEffect(() => {
    if (consent() === "granted") {
      loadClarity();
    }
    if (!hasTrackedScreenView.current) {
      hasTrackedScreenView.current = true;
      track("screen_view");
    }
  }, []);

  useEffect(() => {
    try {
      const stateToSave: PersistedState = {
        subscription,
        invoices,
        willProfile,
        generatedWill,
        auditResult,
        vaultAssets,
        counselMessages,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore quota errors
    }
  }, [
    subscription,
    invoices,
    willProfile,
    generatedWill,
    auditResult,
    vaultAssets,
    counselMessages,
  ]);

  const navigateTo = (view: AppView) => {
    if (view === "builder" && activeView !== "builder") {
      track("goal_complete");
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMainCtaClick = () => {
    track("cta_click");
    navigateTo("builder");
  };

  const handleConsentChoice = (choice: "granted" | "denied") => {
    setConsent(choice);
    setConsentChoice(choice);
  };

  const openCheckoutModal = (tierId: MembershipTierId, cycle: BillingCycle) => {
    setCheckoutModal({ open: true, tierId, cycle });
  };

  const handleConfirmSubscription = ({
    tierId,
    billingCycle,
    paymentMethodLabel,
    finalAmountSgd,
    promoCode,
    isTrial,
  }: {
    tierId: MembershipTierId;
    billingCycle: BillingCycle;
    paymentMethodLabel: string;
    finalAmountSgd: number;
    promoCode?: string;
    isTrial?: boolean;
  }) => {
    const plan = MEMBERSHIP_PLANS[tierId];
    const now = new Date();
    const renewal = new Date(now);
    if (isTrial) {
      renewal.setDate(renewal.getDate() + 14);
    } else if (billingCycle === "annual") {
      renewal.setFullYear(renewal.getFullYear() + 1);
    } else {
      renewal.setMonth(renewal.getMonth() + 1);
    }

    const formattedRenewal = renewal.toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const formattedToday = now.toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    setSubscription((prev) => ({
      ...prev,
      tierId,
      billingCycle,
      renewalDate: formattedRenewal,
      paymentMethodLabel,
      promoCodeApplied: promoCode,
      solicitorCreditsRemaining:
        tierId === "private_wealth"
          ? Math.max(prev.solicitorCreditsRemaining, 1)
          : prev.solicitorCreditsRemaining,
    }));

    const newInvoice: InvoiceRecord = {
      id: `INV-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
      date: formattedToday,
      description: `${plan.name} Membership (${
        tierId === "essential"
          ? "Complimentary"
          : isTrial
          ? "14-Day Free Trial"
          : billingCycle === "annual"
          ? "Annual"
          : "Monthly"
      })${promoCode ? ` · Promo ${promoCode}` : ""}`,
      billingCycle,
      amountSgd: finalAmountSgd,
      status: "Paid",
      paymentMethod: paymentMethodLabel,
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    setCheckoutModal((prev) => ({ ...prev, open: false }));
  };

  const handleBookSolicitorReview = () => {
    const now = new Date();
    const formattedToday = now.toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const usingCredit =
      subscription.tierId === "private_wealth" && subscription.solicitorCreditsRemaining > 0;
    const amount = usingCredit ? 0 : subscription.tierId === "family_guard" ? 180 : 280;

    if (usingCredit) {
      setSubscription((prev) => ({
        ...prev,
        solicitorCreditsRemaining: Math.max(0, prev.solicitorCreditsRemaining - 1),
      }));
    }

    const newInvoice: InvoiceRecord = {
      id: `INV-${now.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
      date: formattedToday,
      description: usingCredit
        ? "Singapore Advocate & Solicitor Will Review (Included Credit)"
        : "Singapore Advocate & Solicitor Will Review (Add-on)",
      billingCycle: "one-time",
      amountSgd: amount,
      status: "Paid",
      paymentMethod: usingCredit
        ? "Private Wealth Included Credit"
        : subscription.paymentMethodLabel === "No payment card on file"
        ? "PayNow Singapore"
        : subscription.paymentMethodLabel,
    };

    setInvoices((prev) => [newInvoice, ...prev]);
  };

  const handleAddAsset = (assetInput: Omit<VaultAsset, "id" | "lastVerified">) => {
    const today = new Date().toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const nextAsset: VaultAsset = {
      ...assetInput,
      id: `asset-${Date.now()}`,
      lastVerified: today,
    };
    setVaultAssets((prev) => [nextAsset, ...prev]);
  };

  const handleDeleteAsset = (id: string) => {
    setVaultAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handlePrimaryHeaderAction = () => {
    if (activeView === "overview") {
      navigateTo("builder");
      return;
    }
    if (subscription.tierId === "essential") {
      openCheckoutModal("family_guard", "annual");
    } else {
      navigateTo("membership");
    }
  };

  const handleLoadSampleAndOpenBuilder = () => {
    const plan = MEMBERSHIP_PLANS[subscription.tierId];
    setWillProfile({
      ...SAMPLE_WILL_PROFILE,
      includeMirrorWill: plan.limits.includesMirrorWill,
      enableTestamentaryTrust: plan.limits.includesTestamentaryTrust,
    });
    navigateTo("builder");
  };

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#F8F9FA] text-[#111827] ${
        consentChoice === null ? "pb-28 sm:pb-20" : ""
      }`}
    >
      <TopBar
        activeView={activeView}
        onNavigate={navigateTo}
        currentTier={subscription.tierId}
        onPrimaryAction={handlePrimaryHeaderAction}
      />

      <main className="flex-1">
        {activeView === "overview" && (
          <OverviewPage
            currentTierId={subscription.tierId}
            showVideo={abVariant === "B"}
            onMainCtaClick={handleMainCtaClick}
            onNavigate={navigateTo}
            onSelectPlan={openCheckoutModal}
            onLoadSampleAndOpenBuilder={handleLoadSampleAndOpenBuilder}
          />
        )}

        {activeView === "builder" && (
          <WillBuilder
            profile={willProfile}
            onChangeProfile={setWillProfile}
            generatedWill={generatedWill}
            onSetGeneratedWill={setGeneratedWill}
            auditResult={auditResult}
            onSetAuditResult={setAuditResult}
            subscription={subscription}
            onIncrementWillGeneration={() =>
              setSubscription((prev) => ({
                ...prev,
                willGenerationsUsed: prev.willGenerationsUsed + 1,
              }))
            }
            onPromptUpgrade={openCheckoutModal}
          />
        )}

        {activeView === "counsel" && (
          <EstateCounsel
            messages={counselMessages}
            onAddMessages={(newMsgs) =>
              setCounselMessages((prev) => [...prev, ...newMsgs])
            }
            onResetThread={() => setCounselMessages([])}
            subscription={subscription}
            onIncrementQueryUsage={() =>
              setSubscription((prev) => ({
                ...prev,
                counselQueriesUsed: prev.counselQueriesUsed + 1,
              }))
            }
            willProfile={willProfile}
            onPromptUpgrade={openCheckoutModal}
          />
        )}

        {activeView === "vault" && (
          <AssetVault
            assets={vaultAssets}
            onAddAsset={handleAddAsset}
            onDeleteAsset={handleDeleteAsset}
            subscription={subscription}
            onPromptUpgrade={openCheckoutModal}
          />
        )}

        {activeView === "membership" && (
          <MembershipPage
            subscription={subscription}
            invoices={invoices}
            vaultAssetCount={vaultAssets.length}
            onSelectPlan={openCheckoutModal}
            onBookSolicitorReview={handleBookSolicitorReview}
          />
        )}
      </main>

      <SubscriptionModal
        isOpen={checkoutModal.open}
        targetTierId={checkoutModal.tierId}
        initialCycle={checkoutModal.cycle}
        currentSubscription={subscription}
        onClose={() => setCheckoutModal((prev) => ({ ...prev, open: false }))}
        onConfirmSubscription={handleConfirmSubscription}
      />

      {/* Bottom Consent Notice — shown until the visitor chooses Accept or Decline */}
      {consentChoice === null && (
        <div
          role="region"
          aria-label="Analytics consent notice"
          className="no-print fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[#CBD5E1] shadow-lg"
        >
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs sm:text-sm text-[#334155] leading-relaxed max-w-3xl">
              This class prototype records which version you saw and what you pressed, to test a
              design. Nothing about your visit leaves this browser unless you agree.
            </p>
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => handleConsentChoice("granted")}
                className="flex-1 sm:flex-none sm:w-28 py-2.5 px-4 text-sm font-medium bg-[#111827] hover:bg-[#334155] text-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => handleConsentChoice("denied")}
                className="flex-1 sm:flex-none sm:w-28 py-2.5 px-4 text-sm font-medium bg-[#111827] hover:bg-[#334155] text-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
