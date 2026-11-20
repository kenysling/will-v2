import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, ShieldAlert } from "lucide-react";
import { COUNSEL_SUGGESTED_TOPICS, MEMBERSHIP_PLANS } from "../data/plans";
import {
  BillingCycle,
  CounselMessage,
  MembershipTierId,
  SubscriptionState,
  WillProfile,
} from "../types/estate";
import { MarkdownText } from "./MarkdownText";
import { answerEstateQuestionClient } from "../utils/clientEstateEngine";

interface EstateCounselProps {
  messages: CounselMessage[];
  onAddMessages: (newMessages: CounselMessage[]) => void;
  onResetThread: () => void;
  subscription: SubscriptionState;
  onIncrementQueryUsage: () => void;
  willProfile: WillProfile;
  onPromptUpgrade: (tierId: MembershipTierId, cycle: BillingCycle) => void;
}

export const EstateCounsel: React.FC<EstateCounselProps> = ({
  messages,
  onAddMessages,
  onResetThread,
  subscription,
  onIncrementQueryUsage,
  willProfile,
  onPromptUpgrade,
}) => {
  const [input, setInput] = useState("");
  const [includeProfileContext, setIncludeProfileContext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const plan = MEMBERSHIP_PLANS[subscription.tierId];
  const limit = plan.limits.counselQueriesPerMonth;
  const isAtQuota = limit !== "unlimited" && subscription.counselQueriesUsed >= limit;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendQuestion = (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    if (isAtQuota) {
      setErrorMessage(
        `You have used all ${limit} monthly Estate Counsel questions on the ${plan.name} plan. Upgrade to Family Guard for 100 monthly queries.`
      );
      return;
    }

    setErrorMessage(null);
    const nowLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: CounselMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: nowLabel,
    };

    setInput("");
    setIsLoading(true);
    const hasProfileData = Boolean(willProfile.fullName.trim());
    const replyText = answerEstateQuestionClient(
      trimmed,
      includeProfileContext && hasProfileData ? willProfile : null
    );
    const assistantMsg: CounselMessage = {
      id: `a-${Date.now() + 1}`,
      role: "assistant",
      content: replyText,
      timestamp: nowLabel,
    };

    onAddMessages([userMsg, assistantMsg]);
    onIncrementQueryUsage();
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Reference & Context Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6">
            <p className="text-xs font-medium text-[#475569]">
              Singapore Estate Planning Assistant
            </p>
            <h1 className="font-display text-2xl font-semibold text-[#111827] mt-1">
              Estate Counsel
            </h1>
            <p className="text-xs text-[#475569] leading-relaxed mt-2">
              Ask practical questions on the Wills Act, CPF Nominations, Joint Tenancy property,
              Lasting Power of Attorney (LPA), and guardianship arrangements.
            </p>

            {/* Context Toggle */}
            <div className="mt-5 pt-5 border-t border-[#E2E8F0]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeProfileContext}
                  onChange={(e) => setIncludeProfileContext(e.target.checked)}
                  className="mt-0.5 rounded border-[#CBD5E1] text-[#0F4C3A] focus:ring-[#0F4C3A]"
                />
                <span className="text-xs text-[#334155] leading-relaxed">
                  <strong className="font-medium text-[#111827] block">
                    Share active Will Builder profile
                  </strong>
                  {willProfile.fullName
                    ? `Contextualized for ${willProfile.fullName} (${willProfile.maritalStatus})`
                    : "Complete Step 1 in Will Builder to personalize answers."}
                </span>
              </label>
            </div>

            {/* Monthly Allowance */}
            <div className="mt-5 pt-5 border-t border-[#E2E8F0]">
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-[#475569]">{plan.name} Plan Allowance</span>
                <span className="font-mono tabular-nums font-medium text-[#111827]">
                  {subscription.counselQueriesUsed} / {limit === "unlimited" ? "Unlimited" : limit}
                </span>
              </div>
              {limit !== "unlimited" && (
                <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isAtQuota ? "bg-[#DC2626]" : "bg-[#0F4C3A]"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((subscription.counselQueriesUsed / limit) * 100))}%`,
                    }}
                  />
                </div>
              )}
              {subscription.tierId === "essential" && (
                <button
                  type="button"
                  onClick={() => onPromptUpgrade("family_guard", "annual")}
                  className="mt-3 text-xs font-medium text-[#0F4C3A] hover:underline underline-offset-4 cursor-pointer"
                >
                  Upgrade to Family Guard for 100 monthly queries →
                </button>
              )}
            </div>
          </div>

          {/* Curated Singapore Statutory Topics */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6">
            <p className="text-xs font-semibold text-[#111827] mb-3">
              Common Singapore Estate Questions
            </p>
            <div className="divide-y divide-[#E2E8F0]">
              {COUNSEL_SUGGESTED_TOPICS.map((topic) => (
                <button
                  key={topic.title}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void sendQuestion(topic.prompt)}
                  className="w-full text-left py-3 first:pt-1 last:pb-0 group cursor-pointer disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-[#111827] group-hover:text-[#0F4C3A] transition-colors">
                    {topic.title}
                  </p>
                  <p className="text-xs text-[#64748B] line-clamp-2 mt-0.5 leading-relaxed">
                    {topic.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Conversation Panel */}
        <section className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-lg flex flex-col h-[calc(100vh-140px)] min-h-[580px]">
          {/* Thread Header */}
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
            <div className="text-xs text-[#475569]">
              <span className="font-semibold text-[#111827]">Advisory Session</span>
              <span aria-hidden="true" className="mx-2">·</span>
              <span>Singapore Jurisdiction</span>
            </div>
            <button
              type="button"
              onClick={onResetThread}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] hover:text-[#111827] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Session
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.length === 0 ? (
              <div className="max-w-lg mx-auto text-center py-16">
                <h2 className="font-display text-2xl font-semibold text-[#111827]">
                  How can I clarify your estate plan today?
                </h2>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed">
                  Select a Singapore estate topic on the left or type a question about property
                  co-ownership, CPF nominations, guardians, or testamentary trusts.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.role === "user"
                      ? "ml-auto max-w-2xl bg-[#F8F9FA] border border-[#E2E8F0] rounded-lg px-5 py-4"
                      : "mr-auto max-w-3xl border-b border-[#E2E8F0] pb-6 last:border-b-0"
                  }
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5 text-xs text-[#64748B]">
                    <span className="font-medium text-[#111827]">
                      {msg.role === "user" ? "You" : "Estate Counsel"}
                    </span>
                    <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  </div>
                  {msg.role === "user" ? (
                    <p className="text-sm text-[#111827] leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownText content={msg.content} />
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="max-w-3xl py-3 space-y-2.5">
                <p className="text-xs font-medium text-[#0F4C3A]">
                  Reviewing Singapore statutory rules…
                </p>
                <div className="h-3 bg-[#F1F5F9] rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-[#F1F5F9] rounded w-5/6 animate-pulse" />
                <div className="h-3 bg-[#F1F5F9] rounded w-1/2 animate-pulse" />
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mx-6 mb-3 px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5 text-xs text-[#991B1B]">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              {isAtQuota && (
                <button
                  type="button"
                  onClick={() => onPromptUpgrade("family_guard", "annual")}
                  className="text-xs font-semibold text-[#991B1B] underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Upgrade Now
                </button>
              )}
            </div>
          )}

          {/* Input Composer */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-[#E2E8F0] bg-[#FAFAFA]">
            <div className="flex items-end gap-3">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendQuestion(input);
                  }
                }}
                disabled={isLoading || isAtQuota}
                placeholder={
                  isAtQuota
                    ? "Monthly Essential query limit reached — upgrade to continue"
                    : "Ask about Singapore Wills Act, CPF nominations, HDB ownership, or executors…"
                }
                className="flex-1 resize-none px-4 py-2.5 text-sm bg-white border border-[#CBD5E1] rounded-md text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F4C3A] disabled:bg-[#F1F5F9]"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || isAtQuota}
                aria-label="Send question"
                className="h-11 px-4 inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#0F4C3A] hover:bg-[#0A3629] disabled:bg-[#94A3B8] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Ask</span>
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#64748B] mt-2">
              General estate planning guidance aligned with Singapore law; not formal legal
              representation.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
};
