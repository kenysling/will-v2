import {
  AuditFinding,
  AuditResult,
  ComplianceNotice,
  GeneratedWillClause,
  GeneratedWillResult,
  MembershipTierId,
  WillProfile,
} from "../types/estate";

export function generateSingaporeWillClient(
  profile: WillProfile,
  tier: MembershipTierId,
  nextVersion: number
): GeneratedWillResult {
  const nameUpper = (profile.fullName || "TESTATOR").trim().toUpperCase();
  const nric = profile.nricMasked.trim() || "[NRIC / PASSPORT NO.]";
  const address = profile.address.trim() || "[SINGAPORE RESIDENTIAL ADDRESS]";
  const domicile = profile.domicile.trim() || "Republic of Singapore";

  const clauses: string[] = [];
  const summaryClauses: GeneratedWillClause[] = [];
  const complianceNotices: ComplianceNotice[] = [];

  let clauseIdx = 1;

  // 1. Revocation
  const overseasExclusion =
    tier === "private_wealth" && profile.overseasAssetsNote.trim()
      ? ` SAVE AND EXCEPT that this Will shall govern my assets situated in Singapore and expressly shall not revoke any separate testamentary instrument validly executed for my overseas property (${profile.overseasAssetsNote.trim()}).`
      : "";

  clauses.push(
    `${clauseIdx}. REVOCATION\nI, ${profile.fullName.trim()} (NRIC/FIN: ${nric}), of ${address}, being of sound mind, memory and understanding and domiciled in the ${domicile}, DO HEREBY REVOKE all former wills, codicils and testamentary dispositions heretofore made by me and declare this to be my Last Will and Testament.${overseasExclusion}`
  );
  summaryClauses.push({
    clauseNumber: `Clause ${clauseIdx}`,
    title: "Revocation of Prior Wills",
    plainEnglish:
      "Cancels earlier wills so this document stands as your operative Singapore Last Will and Testament.",
  });
  clauseIdx++;

  // 2. Executors & Trustees
  const subExecText = profile.substituteExecutorName.trim()
    ? ` If my said primary Executor shall predecease me, or be unable, unwilling or ineligible to act, I appoint ${profile.substituteExecutorName.trim()} (${profile.substituteExecutorRelationship || "Substitute Executor"}) to be the sole substitute Executor and Trustee of this my Will.`
    : "";

  clauses.push(
    `${clauseIdx}. APPOINTMENT OF EXECUTORS AND TRUSTEES\nI APPOINT ${profile.primaryExecutorName.trim()} (${profile.primaryExecutorRelationship || "Primary Executor"}) to be the primary Executor and Trustee of this my Will.${subExecText}`
  );
  summaryClauses.push({
    clauseNumber: `Clause ${clauseIdx}`,
    title: "Executors & Trustees",
    plainEnglish: `Authorizes ${profile.primaryExecutorName.trim()}${
      profile.substituteExecutorName.trim()
        ? ` (with ${profile.substituteExecutorName.trim()} as backup)`
        : ""
    } to apply for Grant of Probate and administer your estate.`,
  });
  clauseIdx++;

  // 3. Guardianship (if minor children)
  if (profile.hasMinorChildren) {
    const guardianLine = profile.primaryGuardianName.trim()
      ? `I APPOINT ${profile.primaryGuardianName.trim()} to be the testamentary Guardian of my minor child(ren), namely ${
          profile.minorChildrenNames.trim() || "my minor children"
        }, during their minority${
          profile.substituteGuardianName.trim()
            ? `, and if he/she is unable or unwilling to act, I appoint ${profile.substituteGuardianName.trim()} as substitute Guardian.`
            : "."
        }`
      : `I request that the Court appoint a suitable family guardian for my minor child(ren): ${
          profile.minorChildrenNames.trim() || "my minor children"
        }.`;

    clauses.push(`${clauseIdx}. GUARDIANSHIP OF MINOR CHILDREN\n${guardianLine}`);
    summaryClauses.push({
      clauseNumber: `Clause ${clauseIdx}`,
      title: "Minor Guardianship",
      plainEnglish:
        "Designates trusted caregivers for children under age 21 under Singapore's Guardianship of Infants Act.",
    });
    clauseIdx++;
  }

  // 4. Mirror Will Reciprocity (Family Guard+)
  if (profile.includeMirrorWill && profile.spouseName.trim() && tier !== "essential") {
    clauses.push(
      `${clauseIdx}. MIRROR WILL ACKNOWLEDGEMENT\nI record that this Will is prepared in coordination with my spouse, ${profile.spouseName.trim()}, on reciprocal terms; however, neither party is bound by an irrevocable mutual-will trust and either spouse remains free to revise or revoke their individual will during their lifetime.`
    );
    summaryClauses.push({
      clauseNumber: `Clause ${clauseIdx}`,
      title: "Mirror Will Coordination",
      plainEnglish:
        "Coordinates reciprocal provisions with your spouse without locking either spouse into an inflexible mutual-will trust.",
    });
    clauseIdx++;
  }

  // 5. Real Property & Specific Gifts
  if (profile.properties.length > 0 || profile.specificGifts.length > 0) {
    const giftLines: string[] = [];
    profile.properties.forEach((p, idx) => {
      const label =
        p.holdingType === "joint_tenancy"
          ? "held as Joint Tenants (passing by right of survivorship outside this Will unless severed, and falling into my Residuary Estate only if I am the sole surviving owner)"
          : p.holdingType === "tenancy_in_common"
          ? `held as Tenants-in-Common (${p.ownershipShare || "undivided share"})`
          : "held in my sole name";
      giftLines.push(
        `(${String.fromCharCode(97 + idx)}) Regarding my interest in ${
          p.address || "real property"
        }, ${label}: my distributable share shall pass to ${
          p.intendedRecipient || "my Residuary Estate"
        }.`
      );
    });
    profile.specificGifts.forEach((g, idx) => {
      const letter = String.fromCharCode(97 + profile.properties.length + idx);
      giftLines.push(
        `(${letter}) I give free of estate expenses ${g.itemDescription || "the specified item"} to ${
          g.recipientName || "the named recipient"
        }${g.recipientRelationship ? ` (${g.recipientRelationship})` : ""}.`
      );
    });

    clauses.push(`${clauseIdx}. REAL PROPERTY AND SPECIFIC BEQUESTS\n${giftLines.join("\n")}`);
    summaryClauses.push({
      clauseNumber: `Clause ${clauseIdx}`,
      title: "Real Estate & Specific Gifts",
      plainEnglish:
        "Identifies property holding structures and specific heirlooms or cash legacies before residuary division.",
    });
    clauseIdx++;
  }

  // 6. Residuary Estate & Survivorship
  const benLines = profile.beneficiaries.map(
    (b, idx) =>
      `(${idx + 1}) ${b.percentage}% to ${b.fullName || "Unnamed Beneficiary"} (${
        b.relationship || "Beneficiary"
      }${b.idLast4 ? `, ID ending ${b.idLast4}` : ""}); failing whom: ${
        b.substituteInstruction || "equally among my surviving residuary beneficiaries"
      }.`
  );

  clauses.push(
    `${clauseIdx}. RESIDUARY ESTATE AND SURVIVORSHIP\nSubject to the payment of my just debts, funeral and testamentary expenses, I GIVE, DEVISE AND BEQUEATH all the rest, residue and remainder of my real and personal estate whatsoever and wheresoever situated (which I am legally able to dispose of by Will) to the following beneficiaries provided they survive me by at least ${profile.survivorshipDays} clear days:\n${benLines.join("\n")}`
  );
  summaryClauses.push({
    clauseNumber: `Clause ${clauseIdx}`,
    title: "Residuary Estate (100% Allocation)",
    plainEnglish: `Distributes all remaining estate assets across ${profile.beneficiaries.length} named beneficiaries subject to a ${profile.survivorshipDays}-day survivorship period.`,
  });
  clauseIdx++;

  // 7. Testamentary Trust (Family Guard+)
  if (profile.enableTestamentaryTrust && tier !== "essential") {
    clauses.push(
      `${clauseIdx}. TESTAMENTARY TRUST AND DELAYED VESTING\nWhere any beneficiary entitled under this Will has not attained the age of ${profile.minorVestingAge} years at the date of my death, my Trustees shall hold such beneficiary's share UPON TRUST until they attain age ${profile.minorVestingAge}. ${
        profile.trustDistributionsNote.trim() ||
        "My Trustees may apply income and capital at their discretion for the beneficiary's maintenance, education, healthcare and advancement."
      }`
    );
    summaryClauses.push({
      clauseNumber: `Clause ${clauseIdx}`,
      title: `Delayed Vesting Trust (Age ${profile.minorVestingAge})`,
      plainEnglish: `Protects inheritances in trust until age ${profile.minorVestingAge}, allowing trustees to fund education and healthcare.`,
    });
    clauseIdx++;
  }

  // 8. Business Succession (Private Wealth)
  if (tier === "private_wealth" && profile.businessSuccessionNote.trim()) {
    clauses.push(
      `${clauseIdx}. BUSINESS SUCCESSION AND SHAREHOLDINGS\n${profile.businessSuccessionNote.trim()}`
    );
    summaryClauses.push({
      clauseNumber: `Clause ${clauseIdx}`,
      title: "Business Succession",
      plainEnglish:
        "Directs executors on private company share transfers and buy-sell shareholder agreements.",
    });
    clauseIdx++;
  }

  // 9. Funeral & Digital Assets
  const wishesParts: string[] = [
    `I express my non-binding wish for ${profile.funeralWishes.toLowerCase()}${
      profile.funeralNote.trim() ? `: ${profile.funeralNote.trim()}` : "."
    }`,
  ];
  if (profile.digitalAssetsNote.trim()) {
    wishesParts.push(`Digital Assets & Records: ${profile.digitalAssetsNote.trim()}`);
  }
  clauses.push(`${clauseIdx}. FUNERAL WISHES AND DIGITAL ASSETS\n${wishesParts.join("\n")}`);
  summaryClauses.push({
    clauseNumber: `Clause ${clauseIdx}`,
    title: "Funeral & Digital Asset Guidance",
    plainEnglish:
      "Records personal memorial wishes and instructions for locating digital accounts or safe deposit records.",
  });

  // Testimonium & Section 6 Attestation Clause
  const attestationBlock = `IN WITNESS WHEREOF I have hereunto set my hand to this my Last Will and Testament this ______ day of __________________, 20____.


SIGNED by the abovenamed Testator, ${profile.fullName.trim()}, as his/her Last Will and Testament in the joint presence of us both, present at the same time, who at his/her request, in his/her presence and in the presence of each other have hereunto subscribed our names as witnesses (neither of us nor our spouses being beneficiaries under this Will):


___________________________________________
Signature of Testator (${profile.fullName.trim()})


WITNESS 1                                     WITNESS 2
Signature: _____________________________      Signature: _____________________________
Full Name: _____________________________      Full Name: _____________________________
NRIC/Passport: _________________________      NRIC/Passport: _________________________
Address: _______________________________      Address: _______________________________`;

  const formalWillText = `${clauses.join("\n\n")}\n\n${attestationBlock}`;

  // Statutory Compliance Notices
  complianceNotices.push({
    severity: "Action Required",
    title: "Wet-Ink Physical Signing Required (Section 6, Wills Act)",
    guidance:
      "Singapore law does not recognize electronic signatures for wills. Print this document and sign it in the simultaneous physical presence of two independent adult witnesses (aged 21+) who are not beneficiaries or spouses of beneficiaries.",
  });

  complianceNotices.push({
    severity: "Important",
    title: "CPF Savings Pass Outside This Will",
    guidance:
      "Central Provident Fund (CPF) balances cannot be distributed by a Will. Ensure your CPF Nomination is updated directly with the CPF Board via Singpass.",
  });

  if (profile.properties.some((p) => p.holdingType === "joint_tenancy")) {
    complianceNotices.push({
      severity: "Important",
      title: "Joint Tenancy Right of Survivorship",
      guidance:
        "Properties held under Joint Tenancy automatically pass to the surviving co-owner regardless of the clauses in this Will unless the Joint Tenancy is formally severed into Tenancy-in-Common.",
    });
  }

  if (profile.isMuslimEstate) {
    complianceNotices.push({
      severity: "Action Required",
      title: "AMLA / Syariah Faraid One-Third Limit",
      guidance:
        "Under the Administration of Muslim Law Act (AMLA), a Muslim testator domiciled in Singapore may generally bequeath up to one-third (1/3) of the estate by Wasiat to non-Faraid heirs unless all Faraid beneficiaries consent.",
    });
  }

  return {
    documentTitle: `LAST WILL AND TESTAMENT OF ${nameUpper}`,
    formalWillText,
    summaryClauses,
    complianceNotices,
    generatedAt: new Date().toLocaleString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    version: nextVersion,
  };
}

export function reviewWillDraftClient(profile: WillProfile): AuditResult {
  const findings: AuditFinding[] = [];

  if (!profile.substituteExecutorName.trim()) {
    findings.push({
      id: "audit-sub-exec",
      severity: "High",
      clauseRef: "Clause 2 · Executors",
      issue: "No substitute executor appointed.",
      recommendation:
        "If your primary executor predeceases you or cannot act, the family must apply for Letters of Administration with Will Annexed, delaying probate.",
      suggestedClause:
        "SUBSTITUTE EXECUTOR PROVISION: Should my primary Executor predecease me or decline to act, I appoint [Insert Trusted Adult Name & NRIC] as substitute Executor and Trustee with full statutory powers.",
    });
  }

  if (profile.properties.some((p) => p.holdingType === "joint_tenancy")) {
    findings.push({
      id: "audit-jt",
      severity: "Medium",
      clauseRef: "Property Schedule · Joint Tenancy",
      issue: "Joint Tenancy property will bypass residuary distribution on first passing.",
      recommendation:
        "Confirm that you intend full ownership to pass automatically to your surviving co-owner. If you wish your 50% share to pass to children or parents, sever the tenancy at SLA first.",
      suggestedClause:
        "CLARIFICATION OF JOINT PROPERTY: For the avoidance of doubt, any property held by me as Joint Tenant shall pass by survivorship to the surviving joint tenant, and this Will governs such property only if I am the last surviving owner.",
    });
  }

  if (profile.hasMinorChildren && !profile.enableTestamentaryTrust) {
    findings.push({
      id: "audit-minor-trust",
      severity: "Medium",
      clauseRef: "Minor Beneficiaries",
      issue: "Minor children inherit outright at age 21 without trustee maintenance guidance.",
      recommendation:
        "Adding an explicit trustee advancement power ensures guardians can access funds smoothly for tuition and healthcare prior to vesting.",
      suggestedClause:
        "TRUSTEE ADVANCEMENT POWER: My Trustees may pay or apply the whole or any part of the income or capital of a minor beneficiary's presumptive share to their Guardian for education, housing, and medical care.",
    });
  }

  findings.push({
    id: "audit-sec10",
    severity: "Advisory",
    clauseRef: "Attestation · Section 10 Wills Act",
    issue: "Ensure neither witness nor their spouse is named as a beneficiary.",
    recommendation:
      "Under Section 10 of the Singapore Wills Act, any gift to an attesting witness or their spouse is legally void even though the rest of the will remains valid.",
    suggestedClause:
      "INDEPENDENT WITNESS CONFIRMATION: Both attesting witnesses confirm they are aged 21 or above, of sound mind, and neither they nor their spouses receive any beneficial interest under this Will.",
  });

  const highCount = findings.filter((f) => f.severity === "High").length;
  const overallAssessment =
    highCount > 0
      ? `Draft requires ${highCount} priority adjustment before physical witnessing. Review the highlighted findings below and append suggested clauses where relevant.`
      : "Your Singapore Will structure is well-balanced with complete residuary allocation and proper Section 6 attestation formatting. Review the practical reminders below prior to signing.";

  return {
    overallAssessment,
    findings,
    auditedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export function answerEstateQuestionClient(
  question: string,
  profile: WillProfile | null
): string {
  const q = question.toLowerCase();
  const personalIntro = profile?.fullName
    ? `Based on your active profile for **${profile.fullName}** (${profile.maritalStatus}):\n\n`
    : "";

  if (q.includes("cpf")) {
    return `${personalIntro}### CPF Savings & Singapore Wills
- **Outside Your Will**: CPF savings (OA, SA, MA, RA) do **not** form part of your estate covered by a Will. They are distributed strictly according to your **CPF Nomination**.
- **Effect of Marriage**: Under Singapore law, getting married automatically revokes an earlier CPF Nomination (just as marriage revokes an earlier Will unless made in contemplation of marriage). Divorce does **not** automatically revoke a CPF nomination.
- **Action Step**: Log into the CPF Board portal with Singpass to verify or update your Cash Nomination so it aligns with your Will beneficiaries.`;
  }

  if (q.includes("joint") || q.includes("hdb") || q.includes("tenancy") || q.includes("property")) {
    return `${personalIntro}### Joint Tenancy vs. Tenancy-in-Common in Singapore
- **Joint Tenancy (Right of Survivorship)**: Upon the passing of one co-owner, their interest passes automatically to the surviving joint tenant. A Will **cannot** override Joint Tenancy.
- **Tenancy-in-Common**: Each owner holds a distinct percentage share (e.g., 50%/50% or 70%/30%) which **does** pass according to your Will (or Intestate Succession Act if no Will exists).
- **Action Step**: Check your HDB / SLA title deed. If you want your share of a jointly owned property to go to children or parents instead of the co-owner, consult a conveyancing solicitor to sever Joint Tenancy into Tenancy-in-Common.`;
  }

  if (q.includes("witness") || q.includes("section 6") || q.includes("sign") || q.includes("valid")) {
    return `${personalIntro}### Valid Will Execution Under Singapore's Wills Act
- **Section 6 Requirements**: You must be at least 21 years old, of sound mind, and sign the printed Will in wet ink at the foot of the document in the **simultaneous physical presence** of **two witnesses**. Electronic signatures are not valid for Singapore wills.
- **Section 10 Pitfall**: Neither witness — nor the **spouse** of either witness — may be a beneficiary under the Will, otherwise their gift is legally void.
- **Best Practice**: Choose two neutral adult friends or colleagues (aged 21+) and optionally register custody details with the Singapore Academy of Law (SAL) Wills Registry.`;
  }

  if (q.includes("lpa") || q.includes("lasting power") || q.includes("mental")) {
    return `${personalIntro}### Will vs. Lasting Power of Attorney (LPA)
- **When a Will Applies**: Takes effect **only after death** to appoint executors, name minor guardians, and distribute probate assets.
- **When an LPA Applies**: Takes effect **while you are alive** if you lose mental capacity (e.g., due to stroke, dementia, or accident), empowering trusted Donees to manage your **Personal Welfare** and **Property & Affairs**.
- **Why Both Matter**: Without an LPA, your family cannot access sole bank accounts or sell property to pay medical expenses during incapacity without a costly Deputyship court order. You can draft LPA Form 1 online via OPG Online (Singpass) and have it certified by an accredited doctor, lawyer, or psychiatrist.`;
  }

  if (q.includes("minor") || q.includes("child") || q.includes("trust") || q.includes("guardian")) {
    return `${personalIntro}### Protecting Minor Children in a Singapore Will
- **Testamentary Guardianship**: Appoint both a **Primary Guardian** and a **Substitute Guardian** in your Will to ensure smooth care if both parents pass away while children are under age 21.
- **Delayed Vesting / Testamentary Trust**: Instead of a lump sum at age 21, you can instruct your Trustees to hold children's shares until age **25 or 30**, while permitting discretionary payouts for university tuition, healthcare, and housing.
- **Role Separation**: Many families appoint one trusted person as daily Guardian and another financially experienced family member as Co-Trustee for checks and balances.`;
  }

  if (q.includes("muslim") || q.includes("faraid") || q.includes("amla") || q.includes("syariah")) {
    return `${personalIntro}### Muslim Estates Under AMLA (Singapore)
- **Faraid Default**: Estates of Muslims domiciled in Singapore are governed by Islamic inheritance law (Faraid) under the Administration of Muslim Law Act (AMLA).
- **Wasiat (One-Third Rule)**: A Muslim testator may write a Wasiat covering up to **one-third (1/3)** of their net distributable estate for non-Faraid beneficiaries (such as charities or adopted children). Bequests beyond 1/3 or to existing Faraid heirs require unanimous consent from all Faraid beneficiaries after death.
- **CPF & Joint Assets**: Valid CPF nominations and Joint Tenancy survivorship are recognized outside Faraid under MUIS fatwa rulings.`;
  }

  return `${personalIntro}### Singapore Estate Planning Guidance
- **Core Coverage**: Your Singapore Will governs sole bank accounts, investments, personal property, and Tenancy-in-Common real estate through a Grant of Probate.
- **Assets Requiring Separate Nominations**: Verify your **CPF Nomination** (Singpass), **Insurance Policy Nominations** (Trust vs. Revocable), and whether your property is held as **Joint Tenants** or **Tenants-in-Common**.
- **Execution Readiness**: Make sure you name a **Substitute Executor**, validate that residuary shares total **100%**, and execute the final printed document before **two independent adult witnesses** under Section 6 of the Wills Act.

For complex cross-border properties, family trusts, or business shareholder buy-sell agreements, consider scheduling a Singapore Advocate & Solicitor review.`;
}
