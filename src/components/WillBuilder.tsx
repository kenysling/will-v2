import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  Lock,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { MEMBERSHIP_PLANS, SAMPLE_WILL_PROFILE } from "../data/plans";
import {
  AuditFinding,
  AuditResult,
  BillingCycle,
  GeneratedWillResult,
  MembershipTierId,
  SubscriptionState,
  WillProfile,
} from "../types/estate";
import {
  generateSingaporeWillClient,
  reviewWillDraftClient,
} from "../utils/clientEstateEngine";

interface WillBuilderProps {
  profile: WillProfile;
  onChangeProfile: (next: WillProfile) => void;
  generatedWill: GeneratedWillResult | null;
  onSetGeneratedWill: (result: GeneratedWillResult) => void;
  auditResult: AuditResult | null;
  onSetAuditResult: (result: AuditResult | null) => void;
  subscription: SubscriptionState;
  onIncrementWillGeneration: () => void;
  onPromptUpgrade: (tierId: MembershipTierId, cycle: BillingCycle) => void;
}

const STEPS = [
  { num: 1, title: "Testator & Domicile" },
  { num: 2, title: "Executors & Guardians" },
  { num: 3, title: "Properties & Specific Gifts" },
  { num: 4, title: "Residuary Beneficiaries" },
  { num: 5, title: "Trusts, Wishes & Succession" },
  { num: 6, title: "Generate, Audit & Execute" },
];

export const WillBuilder: React.FC<WillBuilderProps> = ({
  profile,
  onChangeProfile,
  generatedWill,
  onSetGeneratedWill,
  auditResult,
  onSetAuditResult,
  subscription,
  onIncrementWillGeneration,
  onPromptUpgrade,
}) => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"document" | "clauses" | "audit" | "execution">(
    "document"
  );
  const [checkedAttestation, setCheckedAttestation] = useState<Record<string, boolean>>({});

  const plan = MEMBERSHIP_PLANS[subscription.tierId];
  const revLimit = plan.limits.maxWillRevisions;
  const isAtRevisionLimit =
    revLimit !== "unlimited" && subscription.willGenerationsUsed >= revLimit;

  const totalResiduaryPct = useMemo(
    () => profile.beneficiaries.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0),
    [profile.beneficiaries]
  );

  const updateField = <K extends keyof WillProfile>(key: K, value: WillProfile[K]) => {
    onChangeProfile({ ...profile, [key]: value });
  };

  const handleLoadSample = () => {
    onChangeProfile({
      ...SAMPLE_WILL_PROFILE,
      includeMirrorWill: plan.limits.includesMirrorWill
        ? SAMPLE_WILL_PROFILE.includeMirrorWill
        : false,
      enableTestamentaryTrust: plan.limits.includesTestamentaryTrust
        ? SAMPLE_WILL_PROFILE.enableTestamentaryTrust
        : false,
    });
    setApiError(null);
  };

  const handleAddProperty = () => {
    updateField("properties", [
      ...profile.properties,
      {
        id: `prop-${Date.now()}`,
        address: "",
        holdingType: "joint_tenancy",
        ownershipShare: "Joint Tenants",
        intendedRecipient: "Residuary Estate",
      },
    ]);
  };

  const handleAddGift = () => {
    updateField("specificGifts", [
      ...profile.specificGifts,
      {
        id: `gift-${Date.now()}`,
        itemDescription: "",
        recipientName: "",
        recipientRelationship: "",
      },
    ]);
  };

  const handleAddBeneficiary = () => {
    const remaining = Math.max(0, 100 - totalResiduaryPct);
    updateField("beneficiaries", [
      ...profile.beneficiaries,
      {
        id: `ben-${Date.now()}`,
        fullName: "",
        relationship: "",
        idLast4: "",
        percentage: remaining,
        substituteInstruction: "Equally among surviving residuary beneficiaries",
      },
    ]);
  };

  const handleGenerateWill = () => {
    if (!profile.fullName.trim() || !profile.primaryExecutorName.trim()) {
      setApiError("Please provide at least your Full Legal Name (Step 1) and Primary Executor (Step 2).");
      return;
    }
    if (totalResiduaryPct !== 100) {
      setApiError(`Residuary beneficiary shares currently total ${totalResiduaryPct}%. Adjust shares in Step 4 to equal exactly 100%.`);
      return;
    }
    if (isAtRevisionLimit) {
      setApiError(
        `Essential tier includes up to ${revLimit} will drafts. Upgrade to Family Guard for unlimited revisions.`
      );
      return;
    }

    setApiError(null);
    setIsGenerating(true);
    const nextVersion = (generatedWill?.version ?? 0) + 1;
    const drafted = generateSingaporeWillClient(profile, subscription.tierId, nextVersion);
    onSetGeneratedWill(drafted);
    onSetAuditResult(null);
    onIncrementWillGeneration();
    setStep(6);
    setRightTab("document");
    setIsGenerating(false);
  };

  const handleRunRiskAudit = () => {
    if (!plan.limits.includesRiskAudit) {
      onPromptUpgrade("family_guard", "annual");
      return;
    }
    if (!generatedWill?.formalWillText) {
      setApiError("Generate a Will draft first before running the Risk & Ambiguity Audit.");
      return;
    }

    setApiError(null);
    setIsAuditing(true);
    setRightTab("audit");
    const reviewed = reviewWillDraftClient(profile);
    onSetAuditResult(reviewed);
    setIsAuditing(false);
  };

  const handleApplySuggestedClause = (finding: AuditFinding) => {
    if (!generatedWill || !auditResult) return;
    const appendedText = `${generatedWill.formalWillText}\n\n[SUPPLEMENTAL REVISION — ${finding.clauseRef}]\n${finding.suggestedClause}`;
    onSetGeneratedWill({
      ...generatedWill,
      formalWillText: appendedText,
    });
    onSetAuditResult({
      ...auditResult,
      findings: auditResult.findings.map((f) =>
        f.id === finding.id ? { ...f, applied: true } : f
      ),
    });
  };

  const handleDownloadDocument = () => {
    if (!generatedWill) return;
    const watermarkHeader = plan.limits.includesCleanExport
      ? ""
      : "DRAFT PREVIEW — ESSENTIAL TIER (UPGRADE TO FAMILY GUARD FOR WATERMARK-FREE EXECUTION PACKET)\n========================================================================\n\n";
    const fullText = `${watermarkHeader}${generatedWill.documentTitle}\n\n${generatedWill.formalWillText}`;
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (profile.fullName || "Singapore_Will").replace(/\s+/g, "_");
    a.download = `${safeName}_Will_v${generatedWill.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPacket = () => {
    window.print();
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
      {/* Workspace Toolbar */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#E2E8F0]">
        <div>
          <p className="text-xs font-medium text-[#475569]">
            Will Builder · {plan.name} Tier ·{" "}
            <span className="font-mono tabular-nums">
              {subscription.willGenerationsUsed}/
              {revLimit === "unlimited" ? "∞" : revLimit} drafts used
            </span>
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#111827] mt-0.5">
            {profile.fullName ? `Will of ${profile.fullName}` : "Singapore Last Will & Testament"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleLoadSample}
            className="px-3.5 py-2 text-xs font-medium text-[#111827] bg-white border border-[#CBD5E1] hover:border-[#111827] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Load Sample Profile
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateWill()}
            disabled={isGenerating}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0F4C3A] hover:bg-[#0A3629] disabled:bg-[#94A3B8] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGenerating ? "Drafting Formal Clauses…" : "Generate AI Will Draft"}
          </button>
        </div>
      </div>

      {/* Main 3-Column / Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Stepper & Guided Form */}
        <div className="no-print lg:col-span-6 space-y-6">
          {/* Compact Numbered Step Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STEPS.map((s) => {
              const isActive = step === s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className={`px-3 py-2.5 text-left rounded-md border transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#0F4C3A] border-[#0F4C3A] text-white"
                      : "bg-white border-[#E2E8F0] text-[#334155] hover:border-[#CBD5E1]"
                  }`}
                >
                  <span
                    className={`block font-mono text-[11px] tabular-nums ${
                      isActive ? "text-white/75" : "text-[#64748B]"
                    }`}
                  >
                    0{s.num}
                  </span>
                  <span className="block text-xs font-medium truncate mt-0.5">{s.title}</span>
                </button>
              );
            })}
          </div>

          {apiError && (
            <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-md flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#991B1B]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
              {isAtRevisionLimit && (
                <button
                  type="button"
                  onClick={() => onPromptUpgrade("family_guard", "annual")}
                  className="text-xs font-semibold text-[#991B1B] underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Upgrade
                </button>
              )}
            </div>
          )}

          {/* Step Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-5">
            {step === 1 && (
              <>
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#111827]">
                    01. Testator Particulars &amp; Domicile
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1">
                    Enter your legal particulars exactly as shown on your Singapore NRIC or Passport.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      value={profile.fullName}
                      onChange={(e) => updateField("fullName", e.target.value)}
                      placeholder="e.g. Jonathan Tan Wei Ming"
                      className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      NRIC / FIN (Masked or Last 4)
                    </label>
                    <input
                      type="text"
                      value={profile.nricMasked}
                      onChange={(e) => updateField("nricMasked", e.target.value)}
                      placeholder="e.g. S****482E"
                      className="w-full px-3 py-2 text-sm font-mono border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Singapore Residential Address
                  </label>
                  <input
                    type="text"
                    value={profile.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Block / Street, Unit Number, Singapore Postal Code"
                    className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Marital Status
                    </label>
                    <select
                      value={profile.maritalStatus}
                      onChange={(e) =>
                        updateField(
                          "maritalStatus",
                          e.target.value as WillProfile["maritalStatus"]
                        )
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    >
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Legal Domicile
                    </label>
                    <input
                      type="text"
                      value={profile.domicile}
                      onChange={(e) => updateField("domicile", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                </div>

                {/* Muslim / AMLA toggle */}
                <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.isMuslimEstate}
                      onChange={(e) => updateField("isMuslimEstate", e.target.checked)}
                      className="mt-0.5 rounded border-[#CBD5E1] text-[#0F4C3A]"
                    />
                    <span className="text-xs text-[#334155] leading-relaxed">
                      <strong className="text-[#111827]">
                        Muslim Estate (Administration of Muslim Law Act / Faraid)
                      </strong>{" "}
                      — Include statutory notice on the one-third Wasiat limit for non-Faraid heirs.
                    </span>
                  </label>

                  {/* Mirror Will Toggle (Family Guard+) */}
                  <div className="flex items-start justify-between gap-4 pt-2">
                    <label
                      className={`flex items-start gap-3 ${
                        plan.limits.includesMirrorWill ? "cursor-pointer" : "opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!plan.limits.includesMirrorWill}
                        checked={profile.includeMirrorWill}
                        onChange={(e) => updateField("includeMirrorWill", e.target.checked)}
                        className="mt-0.5 rounded border-[#CBD5E1] text-[#0F4C3A]"
                      />
                      <span className="text-xs text-[#334155] leading-relaxed">
                        <strong className="text-[#111827]">
                          Include Mirror Will Spouse Clause
                        </strong>{" "}
                        — Coordinates reciprocal provisions with your spouse.
                      </span>
                    </label>
                    {!plan.limits.includesMirrorWill && (
                      <button
                        type="button"
                        onClick={() => onPromptUpgrade("family_guard", "annual")}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C3A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Lock className="w-3 h-3" />
                        Family Guard
                      </button>
                    )}
                  </div>

                  {profile.includeMirrorWill && plan.limits.includesMirrorWill && (
                    <div>
                      <label className="block text-xs font-medium text-[#475569] mb-1">
                        Spouse&apos;s Full Legal Name
                      </label>
                      <input
                        type="text"
                        value={profile.spouseName}
                        onChange={(e) => updateField("spouseName", e.target.value)}
                        placeholder="Full legal name of spouse"
                        className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#111827]">
                    02. Executors, Trustees &amp; Guardians
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1">
                    Executors apply for the Grant of Probate in Singapore and administer your estate.
                    Always appoint a substitute executor.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Primary Executor Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.primaryExecutorName}
                      onChange={(e) => updateField("primaryExecutorName", e.target.value)}
                      placeholder="Adult aged 21+, not bankrupt"
                      className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      value={profile.primaryExecutorRelationship}
                      onChange={(e) => updateField("primaryExecutorRelationship", e.target.value)}
                      placeholder="e.g. Spouse, Sibling, Trusted Friend"
                      className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Substitute Executor Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.substituteExecutorName}
                      onChange={(e) => updateField("substituteExecutorName", e.target.value)}
                      placeholder="Acts if primary is unable or unwilling"
                      className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Substitute Relationship
                    </label>
                    <input
                      type="text"
                      value={profile.substituteExecutorRelationship}
                      onChange={(e) =>
                        updateField("substituteExecutorRelationship", e.target.value)
                      }
                      placeholder="e.g. Brother"
                      className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0] space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.hasMinorChildren}
                      onChange={(e) => updateField("hasMinorChildren", e.target.checked)}
                      className="rounded border-[#CBD5E1] text-[#0F4C3A]"
                    />
                    <span className="text-xs font-medium text-[#111827]">
                      I have minor children (under age 21 in Singapore) requiring testamentary
                      guardians
                    </span>
                  </label>

                  {profile.hasMinorChildren && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#475569] mb-1">
                          Minor Children Names &amp; Ages
                        </label>
                        <input
                          type="text"
                          value={profile.minorChildrenNames}
                          onChange={(e) => updateField("minorChildrenNames", e.target.value)}
                          placeholder="e.g. Ethan Tan (9) and Chloe Tan (6)"
                          className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#475569] mb-1">
                            Primary Testamentary Guardian
                          </label>
                          <input
                            type="text"
                            value={profile.primaryGuardianName}
                            onChange={(e) => updateField("primaryGuardianName", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#475569] mb-1">
                            Substitute Guardian
                          </label>
                          <input
                            type="text"
                            value={profile.substituteGuardianName}
                            onChange={(e) => updateField("substituteGuardianName", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#111827]">
                      03. Real Property &amp; Specific Bequests
                    </h2>
                    <p className="text-xs text-[#64748B] mt-1">
                      Declare Singapore real estate holding types and any specific personal items or
                      cash legacies.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProperty}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C3A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Property
                  </button>
                </div>

                {profile.properties.length === 0 ? (
                  <p className="text-xs text-[#64748B] py-3 border-y border-[#E2E8F0]">
                    No properties listed yet. All real estate held solely or as Tenants-in-Common
                    will pass into your Residuary Estate by default.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {profile.properties.map((prop, idx) => (
                      <div
                        key={prop.id}
                        className="p-4 bg-[#F8F9FA] border border-[#E2E8F0] rounded-md space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#111827]">
                            Property {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateField(
                                "properties",
                                profile.properties.filter((p) => p.id !== prop.id)
                              )
                            }
                            className="text-xs text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={prop.address}
                          onChange={(e) =>
                            updateField(
                              "properties",
                              profile.properties.map((p) =>
                                p.id === prop.id ? { ...p, address: e.target.value } : p
                              )
                            )
                          }
                          placeholder="Property address"
                          className="w-full px-3 py-1.5 text-sm bg-white border border-[#CBD5E1] rounded-md"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <select
                            value={prop.holdingType}
                            onChange={(e) =>
                              updateField(
                                "properties",
                                profile.properties.map((p) =>
                                  p.id === prop.id
                                    ? {
                                        ...p,
                                        holdingType: e.target.value as
                                          | "sole"
                                          | "joint_tenancy"
                                          | "tenancy_in_common",
                                      }
                                    : p
                                )
                              )
                            }
                            className="px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md"
                          >
                            <option value="joint_tenancy">Joint Tenancy (Survivorship)</option>
                            <option value="tenancy_in_common">Tenancy-in-Common</option>
                            <option value="sole">Sole Ownership</option>
                          </select>
                          <input
                            type="text"
                            value={prop.intendedRecipient}
                            onChange={(e) =>
                              updateField(
                                "properties",
                                profile.properties.map((p) =>
                                  p.id === prop.id
                                    ? { ...p, intendedRecipient: e.target.value }
                                    : p
                                )
                              )
                            }
                            placeholder="Intended recipient / Residuary"
                            className="px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md"
                          />
                        </div>
                        {prop.holdingType === "joint_tenancy" && (
                          <p className="text-[11px] text-[#8C6D46] leading-relaxed">
                            Singapore Law Note: Joint Tenancy passes automatically to the surviving
                            co-owner outside your Will unless formally severed into Tenancy-in-Common.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Specific Gifts */}
                <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111827]">
                      Specific Gifts &amp; Cash Legacies
                    </span>
                    <button
                      type="button"
                      onClick={handleAddGift}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C3A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Specific Gift
                    </button>
                  </div>

                  {profile.specificGifts.map((gift) => (
                    <div
                      key={gift.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={gift.itemDescription}
                        onChange={(e) =>
                          updateField(
                            "specificGifts",
                            profile.specificGifts.map((g) =>
                              g.id === gift.id ? { ...g, itemDescription: e.target.value } : g
                            )
                          )
                        }
                        placeholder="Item or SGD sum"
                        className="sm:col-span-6 px-3 py-1.5 text-xs border border-[#CBD5E1] rounded-md"
                      />
                      <input
                        type="text"
                        value={gift.recipientName}
                        onChange={(e) =>
                          updateField(
                            "specificGifts",
                            profile.specificGifts.map((g) =>
                              g.id === gift.id ? { ...g, recipientName: e.target.value } : g
                            )
                          )
                        }
                        placeholder="Recipient full name"
                        className="sm:col-span-5 px-3 py-1.5 text-xs border border-[#CBD5E1] rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateField(
                            "specificGifts",
                            profile.specificGifts.filter((g) => g.id !== gift.id)
                          )
                        }
                        aria-label="Remove specific gift"
                        className="sm:col-span-1 p-1.5 text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-[#111827]">
                      04. Residuary Estate Distribution
                    </h2>
                    <p className="text-xs text-[#64748B] mt-1">
                      Allocate 100% of your remaining estate after debts, funeral expenses, and
                      specific gifts.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono text-lg font-semibold tabular-nums ${
                        totalResiduaryPct === 100 ? "text-[#0F4C3A]" : "text-[#DC2626]"
                      }`}
                    >
                      {totalResiduaryPct}%
                    </span>
                    <span className="block text-[11px] text-[#64748B]">
                      {totalResiduaryPct === 100 ? "Balanced" : "Must equal 100%"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {profile.beneficiaries.map((ben, idx) => (
                    <div
                      key={ben.id}
                      className="p-4 bg-[#F8F9FA] border border-[#E2E8F0] rounded-md space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#111827]">
                          Beneficiary {idx + 1}
                        </span>
                        {profile.beneficiaries.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateField(
                                "beneficiaries",
                                profile.beneficiaries.filter((b) => b.id !== ben.id)
                              )
                            }
                            className="text-xs text-[#94A3B8] hover:text-[#DC2626] cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <input
                          type="text"
                          value={ben.fullName}
                          onChange={(e) =>
                            updateField(
                              "beneficiaries",
                              profile.beneficiaries.map((b) =>
                                b.id === ben.id ? { ...b, fullName: e.target.value } : b
                              )
                            )
                          }
                          placeholder="Full legal name"
                          className="sm:col-span-5 px-3 py-1.5 text-sm bg-white border border-[#CBD5E1] rounded-md"
                        />
                        <input
                          type="text"
                          value={ben.relationship}
                          onChange={(e) =>
                            updateField(
                              "beneficiaries",
                              profile.beneficiaries.map((b) =>
                                b.id === ben.id ? { ...b, relationship: e.target.value } : b
                              )
                            )
                          }
                          placeholder="Relationship"
                          className="sm:col-span-4 px-3 py-1.5 text-sm bg-white border border-[#CBD5E1] rounded-md"
                        />
                        <div className="sm:col-span-3 relative">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={ben.percentage}
                            onChange={(e) =>
                              updateField(
                                "beneficiaries",
                                profile.beneficiaries.map((b) =>
                                  b.id === ben.id
                                    ? { ...b, percentage: Number(e.target.value) }
                                    : b
                                )
                              )
                            }
                            className="w-full pl-3 pr-7 py-1.5 text-sm font-mono tabular-nums bg-white border border-[#CBD5E1] rounded-md text-right"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B]">
                            %
                          </span>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={ben.substituteInstruction}
                        onChange={(e) =>
                          updateField(
                            "beneficiaries",
                            profile.beneficiaries.map((b) =>
                              b.id === ben.id
                                ? { ...b, substituteInstruction: e.target.value }
                                : b
                            )
                          )
                        }
                        placeholder="If this beneficiary predeceases me (substitution rule)"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#CBD5E1] rounded-md"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleAddBeneficiary}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F4C3A] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Residuary Beneficiary
                  </button>

                  <div className="flex items-center gap-2 text-xs text-[#475569]">
                    <label htmlFor="survivorship-select">Survivorship period:</label>
                    <select
                      id="survivorship-select"
                      value={profile.survivorshipDays}
                      onChange={(e) =>
                        updateField("survivorshipDays", Number(e.target.value) as 30 | 60)
                      }
                      className="px-2 py-1 text-xs font-mono bg-white border border-[#CBD5E1] rounded"
                    >
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#111827]">
                    05. Trusts, Wishes &amp; Complex Succession
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1">
                    Configure delayed vesting ages, funeral instructions, and Private Wealth
                    business or overseas estate schedules.
                  </p>
                </div>

                {/* Testamentary Trust (Family Guard+) */}
                <div className="space-y-3 pb-5 border-b border-[#E2E8F0]">
                  <div className="flex items-start justify-between gap-4">
                    <label
                      className={`flex items-start gap-3 ${
                        plan.limits.includesTestamentaryTrust ? "cursor-pointer" : "opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!plan.limits.includesTestamentaryTrust}
                        checked={profile.enableTestamentaryTrust}
                        onChange={(e) => updateField("enableTestamentaryTrust", e.target.checked)}
                        className="mt-0.5 rounded border-[#CBD5E1] text-[#0F4C3A]"
                      />
                      <span className="text-xs text-[#334155]">
                        <strong className="text-[#111827] block">
                          Delayed Vesting / Testamentary Trust Clause
                        </strong>
                        Hold minor or young adult inheritances in trust until a chosen age.
                      </span>
                    </label>
                    {!plan.limits.includesTestamentaryTrust && (
                      <button
                        type="button"
                        onClick={() => onPromptUpgrade("family_guard", "annual")}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C3A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Lock className="w-3 h-3" />
                        Family Guard
                      </button>
                    )}
                  </div>

                  {profile.enableTestamentaryTrust && plan.limits.includesTestamentaryTrust && (
                    <div className="space-y-3 pl-6">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#475569]">Vesting age:</span>
                        {([21, 25, 30] as const).map((age) => (
                          <button
                            key={age}
                            type="button"
                            onClick={() => updateField("minorVestingAge", age)}
                            className={`px-3 py-1 text-xs font-mono rounded border cursor-pointer ${
                              profile.minorVestingAge === age
                                ? "border-[#0F4C3A] bg-[#0F4C3A] text-white"
                                : "border-[#CBD5E1] text-[#334155]"
                            }`}
                          >
                            Age {age}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={2}
                        value={profile.trustDistributionsNote}
                        onChange={(e) => updateField("trustDistributionsNote", e.target.value)}
                        placeholder="Education, healthcare, and maintenance trustee discretion…"
                        className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                      />
                    </div>
                  )}
                </div>

                {/* Funeral & Digital Assets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Funeral Preference
                    </label>
                    <select
                      value={profile.funeralWishes}
                      onChange={(e) =>
                        updateField(
                          "funeralWishes",
                          e.target.value as WillProfile["funeralWishes"]
                        )
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-[#CBD5E1] rounded-md"
                    >
                      <option value="Cremation">Cremation</option>
                      <option value="Burial">Burial</option>
                      <option value="Family Discretion">Family Discretion</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#475569] mb-1">
                      Memorial / Ash Placement Note
                    </label>
                    <input
                      type="text"
                      value={profile.funeralNote}
                      onChange={(e) => updateField("funeralNote", e.target.value)}
                      placeholder="Optional ceremony wishes"
                      className="w-full px-3 py-2 text-sm border border-[#CBD5E1] rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">
                    Digital Assets &amp; Safe Deposit Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={profile.digitalAssetsNote}
                    onChange={(e) => updateField("digitalAssetsNote", e.target.value)}
                    placeholder="Where password manager recovery keys or safe deposit details are kept (never enter raw passwords)"
                    className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-md focus:outline-none focus:border-[#0F4C3A]"
                  />
                </div>

                {/* Business Succession & Overseas Assets (Private Wealth) */}
                <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#111827]">
                      Business Succession &amp; Multi-Jurisdiction Clauses
                    </span>
                    {!plan.limits.includesBusinessSuccession && (
                      <button
                        type="button"
                        onClick={() => onPromptUpgrade("private_wealth", "annual")}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#8C6D46] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Lock className="w-3 h-3" />
                        Private Wealth
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    disabled={!plan.limits.includesBusinessSuccession}
                    value={profile.businessSuccessionNote}
                    onChange={(e) => updateField("businessSuccessionNote", e.target.value)}
                    placeholder="Private company UEN shares, Buy-Sell agreements, or family holding instructions…"
                    className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-md disabled:bg-[#F8F9FA] disabled:text-[#94A3B8]"
                  />
                  <textarea
                    rows={2}
                    disabled={!plan.limits.includesBusinessSuccession}
                    value={profile.overseasAssetsNote}
                    onChange={(e) => updateField("overseasAssetsNote", e.target.value)}
                    placeholder="Scope exclusion for separate foreign wills (e.g. UK, Australia, Malaysia)…"
                    className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-md disabled:bg-[#F8F9FA] disabled:text-[#94A3B8]"
                  />
                </div>
              </>
            )}

            {step === 6 && (
              <>
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#111827]">
                    06. Draft Generation, Risk Audit &amp; Execution
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1">
                    Review readiness summary below, generate your AI-drafted Singapore Will, and run
                    a Clause Risk Audit before printing for two-witness execution.
                  </p>
                </div>

                <dl className="divide-y divide-[#E2E8F0] border-y border-[#E2E8F0] text-xs">
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#64748B]">Testator</dt>
                    <dd className="font-medium text-[#111827] text-right">
                      {profile.fullName || "Not entered"}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#64748B]">Executors</dt>
                    <dd className="font-medium text-[#111827] text-right">
                      {profile.primaryExecutorName || "Missing"}
                      {profile.substituteExecutorName
                        ? ` (Sub: ${profile.substituteExecutorName})`
                        : ""}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#64748B]">Residuary Allocation</dt>
                    <dd
                      className={`font-mono tabular-nums font-semibold ${
                        totalResiduaryPct === 100 ? "text-[#0F4C3A]" : "text-[#DC2626]"
                      }`}
                    >
                      {totalResiduaryPct}% across {profile.beneficiaries.length} beneficiaries
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-[#64748B]">Export Quality</dt>
                    <dd className="text-[#111827]">
                      {plan.limits.includesCleanExport
                        ? "Clean Legal Print & Text Packet"
                        : "Watermarked Essential Preview"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleGenerateWill()}
                    disabled={isGenerating}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-[#0F4C3A] hover:bg-[#0A3629] disabled:bg-[#94A3B8] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isGenerating
                      ? "Drafting Singapore Will…"
                      : generatedWill
                      ? "Regenerate Draft"
                      : "Generate Formal Will"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleRunRiskAudit()}
                    disabled={isAuditing || !generatedWill}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#111827] bg-white border border-[#CBD5E1] hover:border-[#111827] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {!plan.limits.includesRiskAudit && <Lock className="w-3.5 h-3.5 text-[#0F4C3A]" />}
                    <span>{isAuditing ? "Auditing Clauses…" : "Run AI Risk Audit"}</span>
                  </button>
                </div>
              </>
            )}

            {/* Step Navigation Footer */}
            <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <button
                type="button"
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="px-3.5 py-2 text-xs font-medium text-[#475569] hover:text-[#111827] disabled:opacity-40 cursor-pointer"
              >
                ← Previous Step
              </button>
              {step < 6 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(6, s + 1))}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#111827] hover:bg-[#0F4C3A] rounded-md transition-colors cursor-pointer"
                >
                  Continue to Step 0{step + 1} →
                </button>
              ) : (
                <span className="text-xs text-[#64748B]">Ready for drafting &amp; review</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Live Document Preview, Clause Summary, AI Risk Audit & Attestation */}
        <div className="lg:col-span-6 space-y-4">
          {/* Sub-navigation Tabs */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center p-1 bg-[#E2E8F0]/70 rounded-md overflow-x-auto">
              {(
                [
                  { id: "document", label: "Formal Draft" },
                  { id: "clauses", label: "Clause Guide" },
                  { id: "audit", label: "AI Risk Audit" },
                  { id: "execution", label: "Section 6 Checklist" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRightTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    rightTab === tab.id
                      ? "bg-white text-[#111827] shadow-xs"
                      : "text-[#475569] hover:text-[#111827]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {generatedWill && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadDocument}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#111827] bg-white border border-[#CBD5E1] hover:border-[#111827] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .txt
                </button>
                <button
                  type="button"
                  onClick={handlePrintPacket}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0F4C3A] hover:bg-[#0A3629] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Packet
                </button>
              </div>
            )}
          </div>

          {/* Right Panel Body */}
          <div className="print-only-will bg-white border border-[#E2E8F0] rounded-lg p-6 lg:p-8 min-h-[580px]">
            {rightTab === "document" && (
              <>
                {isGenerating ? (
                  <div className="py-16 space-y-4">
                    <p className="text-xs font-medium text-[#0F4C3A]">
                      Assembling formal Singapore Last Will &amp; Testament clauses…
                    </p>
                    <div className="h-5 bg-[#F1F5F9] rounded w-2/3 animate-pulse" />
                    <div className="h-3 bg-[#F1F5F9] rounded w-full animate-pulse" />
                    <div className="h-3 bg-[#F1F5F9] rounded w-11/12 animate-pulse" />
                    <div className="h-3 bg-[#F1F5F9] rounded w-4/5 animate-pulse" />
                  </div>
                ) : generatedWill ? (
                  <div>
                    {!plan.limits.includesCleanExport && (
                      <div className="no-print mb-6 p-3.5 bg-[#F8F9FA] border border-[#E2E8F0] rounded-md flex items-center justify-between gap-4">
                        <span className="text-xs text-[#475569]">
                          Essential Preview Mode — Upgrade to remove draft header notice and unlock
                          AI Clause Risk Audit.
                        </span>
                        <button
                          type="button"
                          onClick={() => onPromptUpgrade("family_guard", "annual")}
                          className="text-xs font-semibold text-[#0F4C3A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Upgrade
                        </button>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between gap-4 pb-4 mb-6 border-b border-[#E2E8F0]">
                      <div>
                        <p className="text-[11px] font-mono text-[#64748B]">
                          Draft v{generatedWill.version} · {generatedWill.generatedAt}
                        </p>
                        <h3 className="font-display text-lg font-semibold text-[#111827] mt-0.5">
                          {generatedWill.documentTitle}
                        </h3>
                      </div>
                    </div>

                    <div className="legal-document-sheet text-sm text-[#1F2937] whitespace-pre-wrap">
                      {generatedWill.formalWillText}
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center max-w-md mx-auto">
                    <FileText className="w-8 h-8 text-[#94A3B8] mx-auto mb-3" />
                    <h3 className="font-display text-xl font-semibold text-[#111827]">
                      Your formal Will preview appears here
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed mt-2">
                      Complete the guided steps on the left — or click{" "}
                      <strong className="text-[#111827]">Load Sample Profile</strong> above — then
                      click <strong className="text-[#111827]">Generate AI Will Draft</strong> to
                      assemble a formal Singapore legal document.
                    </p>
                  </div>
                )}
              </>
            )}

            {rightTab === "clauses" && (
              <div className="space-y-6">
                {!generatedWill ? (
                  <p className="text-xs text-[#64748B] py-12 text-center">
                    Generate a Will draft first to view its plain-English clause breakdown and
                    Singapore compliance notices.
                  </p>
                ) : (
                  <>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-[#111827] mb-3">
                        Singapore Statutory Notices
                      </h3>
                      <div className="divide-y divide-[#E2E8F0] border-y border-[#E2E8F0]">
                        {generatedWill.complianceNotices.map((notice, i) => (
                          <div key={i} className="py-3.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span
                                className={`font-semibold ${
                                  notice.severity === "Action Required"
                                    ? "text-[#DC2626]"
                                    : notice.severity === "Important"
                                    ? "text-[#D97706]"
                                    : "text-[#0F4C3A]"
                                }`}
                              >
                                {notice.severity}
                              </span>
                              <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                              <span className="font-medium text-[#111827]">{notice.title}</span>
                            </div>
                            <p className="text-xs text-[#475569] leading-relaxed mt-1">
                              {notice.guidance}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-display text-lg font-semibold text-[#111827] mb-3">
                        Plain-English Clause Breakdown
                      </h3>
                      <div className="divide-y divide-[#E2E8F0]">
                        {generatedWill.summaryClauses.map((clause, i) => (
                          <div key={i} className="py-3">
                            <p className="text-xs font-semibold text-[#111827]">
                              <span className="font-mono text-[#64748B] mr-2">
                                {clause.clauseNumber}
                              </span>
                              {clause.title}
                            </p>
                            <p className="text-xs text-[#475569] leading-relaxed mt-1">
                              {clause.plainEnglish}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {rightTab === "audit" && (
              <div>
                {!plan.limits.includesRiskAudit ? (
                  <div className="py-12 text-center max-w-md mx-auto">
                    <Lock className="w-7 h-7 text-[#0F4C3A] mx-auto mb-3" />
                    <h3 className="font-display text-xl font-semibold text-[#111827]">
                      AI Legal Risk &amp; Ambiguity Audit
                    </h3>
                    <p className="text-xs text-[#475569] leading-relaxed mt-2">
                      Included in Family Guard and Private Wealth plans. Automatically scans your
                      drafted will for survivorship gaps, Section 10 witness pitfalls, ademption
                      risks, and missing substitute executors with one-click clause insertions.
                    </p>
                    <button
                      type="button"
                      onClick={() => onPromptUpgrade("family_guard", "annual")}
                      className="mt-5 px-5 py-2.5 text-xs font-medium text-white bg-[#0F4C3A] hover:bg-[#0A3629] rounded-md cursor-pointer"
                    >
                      Upgrade to Family Guard · S$29/mo
                    </button>
                  </div>
                ) : isAuditing ? (
                  <div className="py-12 space-y-3">
                    <p className="text-xs font-medium text-[#0F4C3A]">
                      Auditing draft against Singapore Wills Act &amp; probate practice…
                    </p>
                    <div className="h-4 bg-[#F1F5F9] rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-[#F1F5F9] rounded w-full animate-pulse" />
                  </div>
                ) : auditResult ? (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-[#E2E8F0]">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-lg font-semibold text-[#111827]">
                          Clause Audit Report
                        </h3>
                        <span className="text-xs font-mono text-[#64748B]">
                          Audited {auditResult.auditedAt}
                        </span>
                      </div>
                      <p className="text-xs text-[#334155] leading-relaxed mt-2">
                        {auditResult.overallAssessment}
                      </p>
                    </div>

                    <div className="divide-y divide-[#E2E8F0]">
                      {auditResult.findings.map((finding) => (
                        <div key={finding.id} className="py-4 space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-semibold ${
                                  finding.severity === "High"
                                    ? "text-[#DC2626]"
                                    : finding.severity === "Medium"
                                    ? "text-[#D97706]"
                                    : "text-[#0F4C3A]"
                                }`}
                              >
                                {finding.severity}
                              </span>
                              <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                              <span className="font-mono text-[#475569]">{finding.clauseRef}</span>
                            </div>

                            {finding.applied ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0F4C3A]">
                                <Check className="w-3.5 h-3.5" />
                                Applied to Draft
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplySuggestedClause(finding)}
                                className="text-xs font-medium text-[#0F4C3A] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Append Suggested Clause
                              </button>
                            )}
                          </div>
                          <p className="text-sm font-medium text-[#111827]">{finding.issue}</p>
                          <p className="text-xs text-[#475569] leading-relaxed">
                            {finding.recommendation}
                          </p>
                          <div className="p-3 bg-[#F8F9FA] border border-[#E2E8F0] rounded text-xs font-display text-[#1F2937]">
                            {finding.suggestedClause}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-14 text-center max-w-sm mx-auto">
                    <ShieldCheck className="w-8 h-8 text-[#0F4C3A] mx-auto mb-3" />
                    <h3 className="font-display text-lg font-semibold text-[#111827]">
                      Ready to audit your Will draft
                    </h3>
                    <p className="text-xs text-[#64748B] mt-1.5">
                      Run an AI clause review to check for survivorship gaps, execution risks, and
                      ambiguous beneficiary phrasing.
                    </p>
                    <button
                      type="button"
                      disabled={!generatedWill}
                      onClick={() => void handleRunRiskAudit()}
                      className="mt-4 px-4 py-2 text-xs font-medium text-white bg-[#0F4C3A] hover:bg-[#0A3629] disabled:bg-[#94A3B8] rounded-md cursor-pointer"
                    >
                      Run AI Risk Audit
                    </button>
                  </div>
                )}
              </div>
            )}

            {rightTab === "execution" && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-lg font-semibold text-[#111827]">
                    Singapore Section 6 Execution Checklist
                  </h3>
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed">
                    Under Section 6 of the Singapore Wills Act 1838, electronic signatures are not
                    valid for wills. Complete these physical execution steps carefully:
                  </p>
                </div>

                <div className="divide-y divide-[#E2E8F0] border-y border-[#E2E8F0]">
                  {[
                    {
                      id: "c1",
                      text: "Print the complete Will on clean A4 paper and staple all pages securely together.",
                    },
                    {
                      id: "c2",
                      text: "Gather two independent adult witnesses (aged 21+). Under Section 10, neither witness nor their spouse may be a beneficiary.",
                    },
                    {
                      id: "c3",
                      text: "Sign and date the Will in wet ink at the foot of the document while both witnesses are physically present together.",
                    },
                    {
                      id: "c4",
                      text: "Have both witnesses sign and write their full names, NRIC/Passport numbers, and addresses in your presence.",
                    },
                    {
                      id: "c5",
                      text: "Store the signed original safely, inform your Executors of its location, and optionally register its custody with the Singapore Wills Registry (SAL).",
                    },
                    {
                      id: "c6",
                      text: "Review separate nominations: CPF Nomination (online via Singpass), Insurance nominations, and Lasting Power of Attorney (OPG Form 1).",
                    },
                  ].map((item) => (
                    <label
                      key={item.id}
                      className="py-3.5 flex items-start gap-3 cursor-pointer text-xs text-[#334155] leading-relaxed"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checkedAttestation[item.id])}
                        onChange={(e) =>
                          setCheckedAttestation((prev) => ({
                            ...prev,
                            [item.id]: e.target.checked,
                          }))
                        }
                        className="mt-0.5 rounded border-[#CBD5E1] text-[#0F4C3A]"
                      />
                      <span
                        className={
                          checkedAttestation[item.id] ? "line-through text-[#94A3B8]" : ""
                        }
                      >
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
