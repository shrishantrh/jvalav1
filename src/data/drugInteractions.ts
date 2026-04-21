/**
 * Curated drug-drug interaction matrix for v1 CDS.
 * Sources: FDA labels, Lexicomp, Stockley's Drug Interactions (curated subset).
 * Severity levels: contraindicated > major > moderate > minor.
 *
 * Matching is case-insensitive substring on medication names.
 * Each rule lists "drug class" patterns that trigger when both are present.
 */

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface DrugInteraction {
  /** Patterns to match in medication name A (case-insensitive substring) */
  a: string[];
  /** Patterns to match in medication name B */
  b: string[];
  severity: InteractionSeverity;
  mechanism: string;
  clinical_effect: string;
  recommendation: string;
}

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  // ── Anticoagulants + NSAIDs ───────────────────────────────────────────────
  {
    a: ['warfarin', 'coumadin', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'dabigatran', 'pradaxa'],
    b: ['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'diclofenac', 'celecoxib', 'celebrex', 'meloxicam', 'aspirin'],
    severity: 'major',
    mechanism: 'Additive antiplatelet/anticoagulant effects; NSAID-induced GI mucosal injury.',
    clinical_effect: 'Significantly increased risk of bleeding, especially GI hemorrhage.',
    recommendation: 'Avoid combination if possible. If required, use lowest NSAID dose for shortest duration with PPI cover and monitor INR/CBC.',
  },
  // ── SSRIs + MAOIs ─────────────────────────────────────────────────────────
  {
    a: ['fluoxetine', 'prozac', 'sertraline', 'zoloft', 'paroxetine', 'paxil', 'citalopram', 'celexa', 'escitalopram', 'lexapro', 'venlafaxine', 'effexor', 'duloxetine', 'cymbalta'],
    b: ['phenelzine', 'nardil', 'tranylcypromine', 'parnate', 'isocarboxazid', 'selegiline', 'rasagiline'],
    severity: 'contraindicated',
    mechanism: 'Excess serotonergic activity from combined reuptake inhibition + MAO inhibition.',
    clinical_effect: 'Serotonin syndrome — hyperthermia, agitation, clonus, autonomic instability. Potentially fatal.',
    recommendation: 'Contraindicated. 14-day washout required between agents (5 weeks for fluoxetine).',
  },
  // ── SSRIs + Triptans ──────────────────────────────────────────────────────
  {
    a: ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'venlafaxine', 'duloxetine'],
    b: ['sumatriptan', 'imitrex', 'rizatriptan', 'maxalt', 'eletriptan', 'relpax', 'zolmitriptan'],
    severity: 'moderate',
    mechanism: 'Combined serotonergic activity.',
    clinical_effect: 'Increased risk of serotonin syndrome (rare but serious).',
    recommendation: 'Combination usually acceptable; counsel patient on serotonin syndrome symptoms.',
  },
  // ── Statins + Macrolides / Azoles ─────────────────────────────────────────
  {
    a: ['simvastatin', 'zocor', 'lovastatin', 'mevacor', 'atorvastatin', 'lipitor'],
    b: ['clarithromycin', 'biaxin', 'erythromycin', 'itraconazole', 'sporanox', 'ketoconazole', 'voriconazole'],
    severity: 'major',
    mechanism: 'CYP3A4 inhibition increases statin plasma levels 5-20×.',
    clinical_effect: 'Risk of rhabdomyolysis and acute kidney injury.',
    recommendation: 'Avoid combination. Use azithromycin or pravastatin/rosuvastatin as alternatives.',
  },
  // ── ACE-I + Potassium-sparing diuretics / K+ supplements ──────────────────
  {
    a: ['lisinopril', 'enalapril', 'ramipril', 'losartan', 'cozaar', 'valsartan', 'diovan', 'olmesartan'],
    b: ['spironolactone', 'aldactone', 'eplerenone', 'amiloride', 'triamterene', 'potassium chloride', 'klor-con'],
    severity: 'major',
    mechanism: 'Additive hyperkalemic effect.',
    clinical_effect: 'Severe hyperkalemia, cardiac arrhythmias, sudden death.',
    recommendation: 'Monitor serum potassium and renal function within 1 week of initiation and periodically.',
  },
  // ── Opioids + Benzodiazepines ─────────────────────────────────────────────
  {
    a: ['oxycodone', 'oxycontin', 'percocet', 'hydrocodone', 'vicodin', 'norco', 'morphine', 'fentanyl', 'tramadol', 'codeine', 'methadone'],
    b: ['alprazolam', 'xanax', 'lorazepam', 'ativan', 'clonazepam', 'klonopin', 'diazepam', 'valium', 'temazepam', 'midazolam'],
    severity: 'major',
    mechanism: 'Additive CNS and respiratory depression (FDA Black Box).',
    clinical_effect: 'Profound sedation, respiratory depression, coma, death.',
    recommendation: 'Avoid concurrent use. If unavoidable, use lowest doses, monitor closely, prescribe naloxone.',
  },
  // ── Methotrexate + NSAIDs/Sulfonamides ────────────────────────────────────
  {
    a: ['methotrexate', 'trexall', 'rheumatrex'],
    b: ['ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'sulfamethoxazole', 'bactrim', 'septra'],
    severity: 'major',
    mechanism: 'Decreased renal clearance of methotrexate; displacement from protein binding.',
    clinical_effect: 'Methotrexate toxicity: bone marrow suppression, mucositis, hepatotoxicity.',
    recommendation: 'Avoid in high-dose methotrexate regimens. For low-dose RA therapy, monitor CBC/LFTs closely.',
  },
  // ── Lithium + NSAIDs/ACE-I/Diuretics ──────────────────────────────────────
  {
    a: ['lithium', 'lithobid', 'eskalith'],
    b: ['ibuprofen', 'naproxen', 'diclofenac', 'lisinopril', 'enalapril', 'losartan', 'hydrochlorothiazide', 'hctz', 'furosemide', 'lasix'],
    severity: 'major',
    mechanism: 'Reduced renal lithium clearance.',
    clinical_effect: 'Lithium toxicity: tremor, confusion, ataxia, seizures, renal failure.',
    recommendation: 'Monitor lithium levels weekly when starting; adjust dose downward.',
  },
  // ── Clopidogrel + Omeprazole ──────────────────────────────────────────────
  {
    a: ['clopidogrel', 'plavix'],
    b: ['omeprazole', 'prilosec', 'esomeprazole', 'nexium'],
    severity: 'moderate',
    mechanism: 'CYP2C19 inhibition reduces clopidogrel activation.',
    clinical_effect: 'Reduced antiplatelet effect; theoretical increased CV events.',
    recommendation: 'Use pantoprazole or H2 blocker as PPI alternative.',
  },
  // ── Allopurinol + Azathioprine/6-MP ───────────────────────────────────────
  {
    a: ['allopurinol', 'zyloprim'],
    b: ['azathioprine', 'imuran', 'mercaptopurine', 'purinethol'],
    severity: 'major',
    mechanism: 'Xanthine oxidase inhibition prevents purine analog metabolism.',
    clinical_effect: 'Severe bone marrow suppression, pancytopenia.',
    recommendation: 'Reduce thiopurine dose to 25-33% of normal; monitor CBC weekly.',
  },
  // ── Beta-blockers + Verapamil/Diltiazem ───────────────────────────────────
  {
    a: ['metoprolol', 'lopressor', 'toprol', 'atenolol', 'tenormin', 'propranolol', 'inderal', 'carvedilol', 'coreg'],
    b: ['verapamil', 'calan', 'verelan', 'diltiazem', 'cardizem', 'tiazac'],
    severity: 'major',
    mechanism: 'Additive negative chronotropic and inotropic effects on AV node.',
    clinical_effect: 'Bradycardia, AV block, heart failure, hypotension.',
    recommendation: 'Avoid combination unless under cardiology supervision with ECG monitoring.',
  },
  // ── Tramadol + SSRIs ──────────────────────────────────────────────────────
  {
    a: ['tramadol', 'ultram'],
    b: ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'venlafaxine', 'duloxetine'],
    severity: 'moderate',
    mechanism: 'Serotonergic activity + lowered seizure threshold.',
    clinical_effect: 'Serotonin syndrome and seizures.',
    recommendation: 'Use alternative analgesic when possible.',
  },
  // ── Metformin + Iodinated contrast ────────────────────────────────────────
  {
    a: ['metformin', 'glucophage', 'glumetza', 'fortamet', 'janumet'],
    b: ['iodinated contrast', 'iohexol', 'iopamidol', 'iodine contrast'],
    severity: 'major',
    mechanism: 'Contrast-induced nephropathy + metformin accumulation.',
    clinical_effect: 'Lactic acidosis.',
    recommendation: 'Hold metformin at time of contrast and for 48h after; resume after renal function confirmed stable.',
  },
  // ── Digoxin + Amiodarone/Verapamil ────────────────────────────────────────
  {
    a: ['digoxin', 'lanoxin'],
    b: ['amiodarone', 'cordarone', 'pacerone', 'verapamil', 'quinidine', 'dronedarone'],
    severity: 'major',
    mechanism: 'P-glycoprotein inhibition increases digoxin levels.',
    clinical_effect: 'Digoxin toxicity: arrhythmias, nausea, visual disturbance.',
    recommendation: 'Reduce digoxin dose by 50% and monitor levels.',
  },
  // ── Theophylline + Ciprofloxacin ──────────────────────────────────────────
  {
    a: ['theophylline', 'theo-24', 'aminophylline'],
    b: ['ciprofloxacin', 'cipro', 'enoxacin'],
    severity: 'major',
    mechanism: 'CYP1A2 inhibition increases theophylline levels.',
    clinical_effect: 'Theophylline toxicity: seizures, arrhythmias.',
    recommendation: 'Avoid combination; use levofloxacin or moxifloxacin if fluoroquinolone needed.',
  },
  // ── Sildenafil + Nitrates ─────────────────────────────────────────────────
  {
    a: ['sildenafil', 'viagra', 'tadalafil', 'cialis', 'vardenafil', 'levitra'],
    b: ['nitroglycerin', 'isosorbide', 'imdur', 'nitro-bid', 'nitrostat'],
    severity: 'contraindicated',
    mechanism: 'Synergistic guanylate cyclase / cGMP-mediated vasodilation.',
    clinical_effect: 'Severe hypotension, MI, stroke.',
    recommendation: 'Absolute contraindication. 24h separation for sildenafil/vardenafil, 48h for tadalafil.',
  },
  // ── Warfarin + Antibiotics (broad) ────────────────────────────────────────
  {
    a: ['warfarin', 'coumadin'],
    b: ['ciprofloxacin', 'levofloxacin', 'metronidazole', 'flagyl', 'sulfamethoxazole', 'bactrim', 'fluconazole', 'diflucan'],
    severity: 'major',
    mechanism: 'CYP2C9 inhibition / gut flora disruption increases INR.',
    clinical_effect: 'Bleeding risk.',
    recommendation: 'Check INR within 3-5 days of starting antibiotic; consider warfarin dose reduction.',
  },
  // ── Corticosteroids + NSAIDs ──────────────────────────────────────────────
  {
    a: ['prednisone', 'prednisolone', 'methylprednisolone', 'medrol', 'dexamethasone', 'decadron', 'hydrocortisone'],
    b: ['ibuprofen', 'naproxen', 'diclofenac', 'meloxicam', 'aspirin'],
    severity: 'moderate',
    mechanism: 'Additive GI mucosal injury.',
    clinical_effect: 'Increased risk of peptic ulcer and GI bleeding (4× higher).',
    recommendation: 'Add PPI prophylaxis; use shortest duration possible.',
  },
];

/** Find all interactions between an active medication list. */
export function detectInteractions(medicationNames: string[]): Array<DrugInteraction & { drugA: string; drugB: string }> {
  const lower = medicationNames.map(m => ({ original: m, lc: m.toLowerCase() }));
  const found: Array<DrugInteraction & { drugA: string; drugB: string }> = [];
  const seen = new Set<string>();

  for (const rule of DRUG_INTERACTIONS) {
    for (const medA of lower) {
      const matchesA = rule.a.some(p => medA.lc.includes(p));
      if (!matchesA) continue;
      for (const medB of lower) {
        if (medA.original === medB.original) continue;
        const matchesB = rule.b.some(p => medB.lc.includes(p));
        if (!matchesB) continue;
        // Dedupe by sorted pair + severity
        const key = [medA.original, medB.original].sort().join('|') + '|' + rule.severity;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ ...rule, drugA: medA.original, drugB: medB.original });
      }
    }
  }
  return found;
}
