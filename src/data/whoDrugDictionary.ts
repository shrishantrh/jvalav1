// WHO Drug Dictionary Global (WHODD) - Comprehensive subset
// ATC Classification System integrated with common medications

export interface WHODrug {
  id: string;
  drugName: string;
  atcCode: string;
  atcLevel1: string;
  atcLevel2: string;
  atcLevel3: string;
  atcLevel4: string;
  atcLevel5: string;
  commonNames: string[];
  activeIngredient: string;
  drugClass: string;
}

// Comprehensive WHO Drug Dictionary with common medications
export const whoDrugDictionary: WHODrug[] = [
  // === DIABETES MEDICATIONS ===
  {
    id: 'WDD-D01',
    drugName: 'Insulin (Regular)',
    atcCode: 'A10AB01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10A - Insulins and analogues',
    atcLevel4: 'A10AB - Insulins and analogues for injection, fast-acting',
    atcLevel5: 'A10AB01 - Insulin (human)',
    commonNames: ['Humulin R', 'Novolin R', 'Regular Insulin', 'Human Insulin'],
    activeIngredient: 'Insulin Human',
    drugClass: 'Fast-Acting Insulin'
  },
  {
    id: 'WDD-D02',
    drugName: 'Insulin Lispro',
    atcCode: 'A10AB04',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10A - Insulins and analogues',
    atcLevel4: 'A10AB - Insulins and analogues for injection, fast-acting',
    atcLevel5: 'A10AB04 - Insulin lispro',
    commonNames: ['Humalog', 'Admelog', 'Lyumjev'],
    activeIngredient: 'Insulin Lispro',
    drugClass: 'Rapid-Acting Insulin'
  },
  {
    id: 'WDD-D03',
    drugName: 'Insulin Aspart',
    atcCode: 'A10AB05',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10A - Insulins and analogues',
    atcLevel4: 'A10AB - Insulins and analogues for injection, fast-acting',
    atcLevel5: 'A10AB05 - Insulin aspart',
    commonNames: ['NovoLog', 'Fiasp', 'NovoRapid'],
    activeIngredient: 'Insulin Aspart',
    drugClass: 'Rapid-Acting Insulin'
  },
  {
    id: 'WDD-D04',
    drugName: 'Insulin Glargine',
    atcCode: 'A10AE04',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10A - Insulins and analogues',
    atcLevel4: 'A10AE - Insulins and analogues for injection, long-acting',
    atcLevel5: 'A10AE04 - Insulin glargine',
    commonNames: ['Lantus', 'Basaglar', 'Toujeo', 'Semglee'],
    activeIngredient: 'Insulin Glargine',
    drugClass: 'Long-Acting Insulin'
  },
  {
    id: 'WDD-D05',
    drugName: 'Insulin Detemir',
    atcCode: 'A10AE05',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10A - Insulins and analogues',
    atcLevel4: 'A10AE - Insulins and analogues for injection, long-acting',
    atcLevel5: 'A10AE05 - Insulin detemir',
    commonNames: ['Levemir'],
    activeIngredient: 'Insulin Detemir',
    drugClass: 'Long-Acting Insulin'
  },
  {
    id: 'WDD-D06',
    drugName: 'Insulin Degludec',
    atcCode: 'A10AE06',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10A - Insulins and analogues',
    atcLevel4: 'A10AE - Insulins and analogues for injection, long-acting',
    atcLevel5: 'A10AE06 - Insulin degludec',
    commonNames: ['Tresiba'],
    activeIngredient: 'Insulin Degludec',
    drugClass: 'Ultra Long-Acting Insulin'
  },
  {
    id: 'WDD-D07',
    drugName: 'Insulin NPH',
    atcCode: 'A10AC01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10A - Insulins and analogues',
    atcLevel4: 'A10AC - Insulins and analogues for injection, intermediate-acting',
    atcLevel5: 'A10AC01 - Insulin (human)',
    commonNames: ['Humulin N', 'Novolin N', 'NPH Insulin', 'Isophane'],
    activeIngredient: 'Insulin Human Isophane',
    drugClass: 'Intermediate-Acting Insulin'
  },
  {
    id: 'WDD-D08',
    drugName: 'Metformin',
    atcCode: 'A10BA02',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10B - Blood glucose lowering drugs, excl. insulins',
    atcLevel4: 'A10BA - Biguanides',
    atcLevel5: 'A10BA02 - Metformin',
    commonNames: ['Glucophage', 'Fortamet', 'Glumetza', 'Riomet'],
    activeIngredient: 'Metformin Hydrochloride',
    drugClass: 'Biguanide'
  },
  {
    id: 'WDD-D09',
    drugName: 'Glipizide',
    atcCode: 'A10BB07',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10B - Blood glucose lowering drugs, excl. insulins',
    atcLevel4: 'A10BB - Sulfonylureas',
    atcLevel5: 'A10BB07 - Glipizide',
    commonNames: ['Glucotrol', 'Glucotrol XL'],
    activeIngredient: 'Glipizide',
    drugClass: 'Sulfonylurea'
  },
  {
    id: 'WDD-D10',
    drugName: 'Glyburide',
    atcCode: 'A10BB01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10B - Blood glucose lowering drugs, excl. insulins',
    atcLevel4: 'A10BB - Sulfonylureas',
    atcLevel5: 'A10BB01 - Glibenclamide',
    commonNames: ['Diabeta', 'Micronase', 'Glynase', 'Glibenclamide'],
    activeIngredient: 'Glyburide',
    drugClass: 'Sulfonylurea'
  },
  {
    id: 'WDD-D11',
    drugName: 'Sitagliptin',
    atcCode: 'A10BH01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10B - Blood glucose lowering drugs, excl. insulins',
    atcLevel4: 'A10BH - Dipeptidyl peptidase 4 (DPP-4) inhibitors',
    atcLevel5: 'A10BH01 - Sitagliptin',
    commonNames: ['Januvia'],
    activeIngredient: 'Sitagliptin Phosphate',
    drugClass: 'DPP-4 Inhibitor'
  },
  {
    id: 'WDD-D12',
    drugName: 'Semaglutide',
    atcCode: 'A10BJ06',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10B - Blood glucose lowering drugs, excl. insulins',
    atcLevel4: 'A10BJ - Glucagon-like peptide-1 (GLP-1) analogues',
    atcLevel5: 'A10BJ06 - Semaglutide',
    commonNames: ['Ozempic', 'Wegovy', 'Rybelsus'],
    activeIngredient: 'Semaglutide',
    drugClass: 'GLP-1 Agonist'
  },
  {
    id: 'WDD-D13',
    drugName: 'Liraglutide',
    atcCode: 'A10BJ02',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10B - Blood glucose lowering drugs, excl. insulins',
    atcLevel4: 'A10BJ - Glucagon-like peptide-1 (GLP-1) analogues',
    atcLevel5: 'A10BJ02 - Liraglutide',
    commonNames: ['Victoza', 'Saxenda'],
    activeIngredient: 'Liraglutide',
    drugClass: 'GLP-1 Agonist'
  },
  {
    id: 'WDD-D14',
    drugName: 'Empagliflozin',
    atcCode: 'A10BK03',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A10 - Drugs used in diabetes',
    atcLevel3: 'A10B - Blood glucose lowering drugs, excl. insulins',
    atcLevel4: 'A10BK - Sodium-glucose co-transporter 2 (SGLT2) inhibitors',
    atcLevel5: 'A10BK03 - Empagliflozin',
    commonNames: ['Jardiance'],
    activeIngredient: 'Empagliflozin',
    drugClass: 'SGLT2 Inhibitor'
  },

  // === CARDIOVASCULAR ===
  {
    id: 'WDD-C01',
    drugName: 'Lisinopril',
    atcCode: 'C09AA03',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C09 - Agents acting on the renin-angiotensin system',
    atcLevel3: 'C09A - ACE inhibitors, plain',
    atcLevel4: 'C09AA - ACE inhibitors, plain',
    atcLevel5: 'C09AA03 - Lisinopril',
    commonNames: ['Zestril', 'Prinivil'],
    activeIngredient: 'Lisinopril',
    drugClass: 'ACE Inhibitor'
  },
  {
    id: 'WDD-C02',
    drugName: 'Amlodipine',
    atcCode: 'C08CA01',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C08 - Calcium channel blockers',
    atcLevel3: 'C08C - Selective calcium channel blockers with mainly vascular effects',
    atcLevel4: 'C08CA - Dihydropyridine derivatives',
    atcLevel5: 'C08CA01 - Amlodipine',
    commonNames: ['Norvasc', 'Amvaz'],
    activeIngredient: 'Amlodipine Besylate',
    drugClass: 'Calcium Channel Blocker'
  },
  {
    id: 'WDD-C03',
    drugName: 'Losartan',
    atcCode: 'C09CA01',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C09 - Agents acting on the renin-angiotensin system',
    atcLevel3: 'C09C - Angiotensin II receptor blockers (ARBs), plain',
    atcLevel4: 'C09CA - Angiotensin II receptor blockers, plain',
    atcLevel5: 'C09CA01 - Losartan',
    commonNames: ['Cozaar'],
    activeIngredient: 'Losartan Potassium',
    drugClass: 'ARB'
  },
  {
    id: 'WDD-C04',
    drugName: 'Metoprolol',
    atcCode: 'C07AB02',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C07 - Beta blocking agents',
    atcLevel3: 'C07A - Beta blocking agents',
    atcLevel4: 'C07AB - Beta blocking agents, selective',
    atcLevel5: 'C07AB02 - Metoprolol',
    commonNames: ['Lopressor', 'Toprol-XL', 'Metoprolol Tartrate', 'Metoprolol Succinate'],
    activeIngredient: 'Metoprolol',
    drugClass: 'Beta Blocker'
  },
  {
    id: 'WDD-C05',
    drugName: 'Atorvastatin',
    atcCode: 'C10AA05',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C10 - Lipid modifying agents',
    atcLevel3: 'C10A - Lipid modifying agents, plain',
    atcLevel4: 'C10AA - HMG CoA reductase inhibitors',
    atcLevel5: 'C10AA05 - Atorvastatin',
    commonNames: ['Lipitor'],
    activeIngredient: 'Atorvastatin Calcium',
    drugClass: 'Statin'
  },
  {
    id: 'WDD-C06',
    drugName: 'Simvastatin',
    atcCode: 'C10AA01',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C10 - Lipid modifying agents',
    atcLevel3: 'C10A - Lipid modifying agents, plain',
    atcLevel4: 'C10AA - HMG CoA reductase inhibitors',
    atcLevel5: 'C10AA01 - Simvastatin',
    commonNames: ['Zocor'],
    activeIngredient: 'Simvastatin',
    drugClass: 'Statin'
  },
  {
    id: 'WDD-C07',
    drugName: 'Hydrochlorothiazide',
    atcCode: 'C03AA03',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C03 - Diuretics',
    atcLevel3: 'C03A - Low-ceiling diuretics, thiazides',
    atcLevel4: 'C03AA - Thiazides, plain',
    atcLevel5: 'C03AA03 - Hydrochlorothiazide',
    commonNames: ['HCTZ', 'Microzide', 'Hydrodiuril'],
    activeIngredient: 'Hydrochlorothiazide',
    drugClass: 'Thiazide Diuretic'
  },
  {
    id: 'WDD-C08',
    drugName: 'Furosemide',
    atcCode: 'C03CA01',
    atcLevel1: 'C - Cardiovascular system',
    atcLevel2: 'C03 - Diuretics',
    atcLevel3: 'C03C - High-ceiling diuretics',
    atcLevel4: 'C03CA - Sulfonamides, plain',
    atcLevel5: 'C03CA01 - Furosemide',
    commonNames: ['Lasix'],
    activeIngredient: 'Furosemide',
    drugClass: 'Loop Diuretic'
  },
  {
    id: 'WDD-C09',
    drugName: 'Warfarin',
    atcCode: 'B01AA03',
    atcLevel1: 'B - Blood and blood forming organs',
    atcLevel2: 'B01 - Antithrombotic agents',
    atcLevel3: 'B01A - Antithrombotic agents',
    atcLevel4: 'B01AA - Vitamin K antagonists',
    atcLevel5: 'B01AA03 - Warfarin',
    commonNames: ['Coumadin', 'Jantoven'],
    activeIngredient: 'Warfarin Sodium',
    drugClass: 'Anticoagulant'
  },
  {
    id: 'WDD-C10',
    drugName: 'Clopidogrel',
    atcCode: 'B01AC04',
    atcLevel1: 'B - Blood and blood forming organs',
    atcLevel2: 'B01 - Antithrombotic agents',
    atcLevel3: 'B01A - Antithrombotic agents',
    atcLevel4: 'B01AC - Platelet aggregation inhibitors excl. heparin',
    atcLevel5: 'B01AC04 - Clopidogrel',
    commonNames: ['Plavix'],
    activeIngredient: 'Clopidogrel Bisulfate',
    drugClass: 'Antiplatelet'
  },

  // === NSAIDs ===
  {
    id: 'WDD-001',
    drugName: 'Ibuprofen',
    atcCode: 'M01AE01',
    atcLevel1: 'M - Musculoskeletal System',
    atcLevel2: 'M01 - Antiinflammatory and antirheumatic products',
    atcLevel3: 'M01A - Antiinflammatory and antirheumatic products, non-steroids',
    atcLevel4: 'M01AE - Propionic acid derivatives',
    atcLevel5: 'M01AE01 - Ibuprofen',
    commonNames: ['Advil', 'Motrin', 'Nurofen', 'IBU'],
    activeIngredient: 'Ibuprofen',
    drugClass: 'NSAID'
  },
  {
    id: 'WDD-002',
    drugName: 'Naproxen',
    atcCode: 'M01AE02',
    atcLevel1: 'M - Musculoskeletal System',
    atcLevel2: 'M01 - Antiinflammatory and antirheumatic products',
    atcLevel3: 'M01A - Antiinflammatory and antirheumatic products, non-steroids',
    atcLevel4: 'M01AE - Propionic acid derivatives',
    atcLevel5: 'M01AE02 - Naproxen',
    commonNames: ['Aleve', 'Naprosyn', 'Anaprox'],
    activeIngredient: 'Naproxen',
    drugClass: 'NSAID'
  },
  {
    id: 'WDD-003',
    drugName: 'Celecoxib',
    atcCode: 'M01AH01',
    atcLevel1: 'M - Musculoskeletal System',
    atcLevel2: 'M01 - Antiinflammatory and antirheumatic products',
    atcLevel3: 'M01A - Antiinflammatory and antirheumatic products, non-steroids',
    atcLevel4: 'M01AH - Coxibs',
    atcLevel5: 'M01AH01 - Celecoxib',
    commonNames: ['Celebrex'],
    activeIngredient: 'Celecoxib',
    drugClass: 'COX-2 Inhibitor'
  },
  {
    id: 'WDD-025',
    drugName: 'Meloxicam',
    atcCode: 'M01AC06',
    atcLevel1: 'M - Musculoskeletal System',
    atcLevel2: 'M01 - Antiinflammatory and antirheumatic products',
    atcLevel3: 'M01A - Antiinflammatory and antirheumatic products, non-steroids',
    atcLevel4: 'M01AC - Oxicams',
    atcLevel5: 'M01AC06 - Meloxicam',
    commonNames: ['Mobic'],
    activeIngredient: 'Meloxicam',
    drugClass: 'NSAID'
  },
  {
    id: 'WDD-026',
    drugName: 'Diclofenac',
    atcCode: 'M01AB05',
    atcLevel1: 'M - Musculoskeletal System',
    atcLevel2: 'M01 - Antiinflammatory and antirheumatic products',
    atcLevel3: 'M01A - Antiinflammatory and antirheumatic products, non-steroids',
    atcLevel4: 'M01AB - Acetic acid derivatives',
    atcLevel5: 'M01AB05 - Diclofenac',
    commonNames: ['Voltaren', 'Cataflam', 'Cambia'],
    activeIngredient: 'Diclofenac Sodium',
    drugClass: 'NSAID'
  },

  // === PAIN MANAGEMENT ===
  {
    id: 'WDD-013',
    drugName: 'Acetaminophen',
    atcCode: 'N02BE01',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N02 - Analgesics',
    atcLevel3: 'N02B - Other analgesics and antipyretics',
    atcLevel4: 'N02BE - Anilides',
    atcLevel5: 'N02BE01 - Paracetamol',
    commonNames: ['Tylenol', 'Paracetamol', 'APAP', 'Panadol'],
    activeIngredient: 'Acetaminophen',
    drugClass: 'Analgesic'
  },
  {
    id: 'WDD-014',
    drugName: 'Tramadol',
    atcCode: 'N02AX02',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N02 - Analgesics',
    atcLevel3: 'N02A - Opioids',
    atcLevel4: 'N02AX - Other opioids',
    atcLevel5: 'N02AX02 - Tramadol',
    commonNames: ['Ultram', 'ConZip', 'Ultram ER'],
    activeIngredient: 'Tramadol Hydrochloride',
    drugClass: 'Opioid Analgesic'
  },
  {
    id: 'WDD-015',
    drugName: 'Gabapentin',
    atcCode: 'N03AX12',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N03 - Antiepileptics',
    atcLevel3: 'N03A - Antiepileptics',
    atcLevel4: 'N03AX - Other antiepileptics',
    atcLevel5: 'N03AX12 - Gabapentin',
    commonNames: ['Neurontin', 'Gralise', 'Horizant'],
    activeIngredient: 'Gabapentin',
    drugClass: 'Anticonvulsant/Neuropathic Pain'
  },
  {
    id: 'WDD-024',
    drugName: 'Aspirin',
    atcCode: 'N02BA01',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N02 - Analgesics',
    atcLevel3: 'N02B - Other analgesics and antipyretics',
    atcLevel4: 'N02BA - Salicylic acid and derivatives',
    atcLevel5: 'N02BA01 - Acetylsalicylic acid',
    commonNames: ['ASA', 'Bayer Aspirin', 'Ecotrin', 'Aspirin'],
    activeIngredient: 'Acetylsalicylic Acid',
    drugClass: 'NSAID/Antiplatelet'
  },
  {
    id: 'WDD-P01',
    drugName: 'Pregabalin',
    atcCode: 'N03AX16',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N03 - Antiepileptics',
    atcLevel3: 'N03A - Antiepileptics',
    atcLevel4: 'N03AX - Other antiepileptics',
    atcLevel5: 'N03AX16 - Pregabalin',
    commonNames: ['Lyrica'],
    activeIngredient: 'Pregabalin',
    drugClass: 'Anticonvulsant/Neuropathic Pain'
  },
  {
    id: 'WDD-P02',
    drugName: 'Oxycodone',
    atcCode: 'N02AA05',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N02 - Analgesics',
    atcLevel3: 'N02A - Opioids',
    atcLevel4: 'N02AA - Natural opium alkaloids',
    atcLevel5: 'N02AA05 - Oxycodone',
    commonNames: ['OxyContin', 'Roxicodone', 'Percocet'],
    activeIngredient: 'Oxycodone Hydrochloride',
    drugClass: 'Opioid Analgesic'
  },
  {
    id: 'WDD-P03',
    drugName: 'Morphine',
    atcCode: 'N02AA01',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N02 - Analgesics',
    atcLevel3: 'N02A - Opioids',
    atcLevel4: 'N02AA - Natural opium alkaloids',
    atcLevel5: 'N02AA01 - Morphine',
    commonNames: ['MS Contin', 'Kadian', 'Morphine Sulfate'],
    activeIngredient: 'Morphine Sulfate',
    drugClass: 'Opioid Analgesic'
  },

  // === CORTICOSTEROIDS ===
  {
    id: 'WDD-011',
    drugName: 'Prednisone',
    atcCode: 'H02AB07',
    atcLevel1: 'H - Systemic hormonal preparations',
    atcLevel2: 'H02 - Corticosteroids for systemic use',
    atcLevel3: 'H02A - Corticosteroids for systemic use, plain',
    atcLevel4: 'H02AB - Glucocorticoids',
    atcLevel5: 'H02AB07 - Prednisone',
    commonNames: ['Deltasone', 'Rayos', 'Prednisone Intensol'],
    activeIngredient: 'Prednisone',
    drugClass: 'Corticosteroid'
  },
  {
    id: 'WDD-012',
    drugName: 'Methylprednisolone',
    atcCode: 'H02AB04',
    atcLevel1: 'H - Systemic hormonal preparations',
    atcLevel2: 'H02 - Corticosteroids for systemic use',
    atcLevel3: 'H02A - Corticosteroids for systemic use, plain',
    atcLevel4: 'H02AB - Glucocorticoids',
    atcLevel5: 'H02AB04 - Methylprednisolone',
    commonNames: ['Medrol', 'Solu-Medrol', 'Depo-Medrol'],
    activeIngredient: 'Methylprednisolone',
    drugClass: 'Corticosteroid'
  },
  {
    id: 'WDD-S01',
    drugName: 'Dexamethasone',
    atcCode: 'H02AB02',
    atcLevel1: 'H - Systemic hormonal preparations',
    atcLevel2: 'H02 - Corticosteroids for systemic use',
    atcLevel3: 'H02A - Corticosteroids for systemic use, plain',
    atcLevel4: 'H02AB - Glucocorticoids',
    atcLevel5: 'H02AB02 - Dexamethasone',
    commonNames: ['Decadron', 'DexPak'],
    activeIngredient: 'Dexamethasone',
    drugClass: 'Corticosteroid'
  },
  {
    id: 'WDD-S02',
    drugName: 'Hydrocortisone',
    atcCode: 'H02AB09',
    atcLevel1: 'H - Systemic hormonal preparations',
    atcLevel2: 'H02 - Corticosteroids for systemic use',
    atcLevel3: 'H02A - Corticosteroids for systemic use, plain',
    atcLevel4: 'H02AB - Glucocorticoids',
    atcLevel5: 'H02AB09 - Hydrocortisone',
    commonNames: ['Cortef', 'Solu-Cortef'],
    activeIngredient: 'Hydrocortisone',
    drugClass: 'Corticosteroid'
  },

  // === DMARDs ===
  {
    id: 'WDD-004',
    drugName: 'Methotrexate',
    atcCode: 'L04AX03',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AX - Other immunosuppressants',
    atcLevel5: 'L04AX03 - Methotrexate',
    commonNames: ['Rheumatrex', 'Trexall', 'Otrexup', 'Rasuvo'],
    activeIngredient: 'Methotrexate',
    drugClass: 'DMARD'
  },
  {
    id: 'WDD-005',
    drugName: 'Hydroxychloroquine',
    atcCode: 'P01BA02',
    atcLevel1: 'P - Antiparasitic products',
    atcLevel2: 'P01 - Antiprotozoals',
    atcLevel3: 'P01B - Antimalarials',
    atcLevel4: 'P01BA - Aminoquinolines',
    atcLevel5: 'P01BA02 - Hydroxychloroquine',
    commonNames: ['Plaquenil'],
    activeIngredient: 'Hydroxychloroquine Sulfate',
    drugClass: 'DMARD'
  },
  {
    id: 'WDD-006',
    drugName: 'Sulfasalazine',
    atcCode: 'A07EC01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A07 - Antidiarrheals, intestinal antiinflammatory agents',
    atcLevel3: 'A07E - Intestinal antiinflammatory agents',
    atcLevel4: 'A07EC - Aminosalicylic acid and similar agents',
    atcLevel5: 'A07EC01 - Sulfasalazine',
    commonNames: ['Azulfidine', 'Salazopyrin'],
    activeIngredient: 'Sulfasalazine',
    drugClass: 'DMARD'
  },
  {
    id: 'WDD-007',
    drugName: 'Leflunomide',
    atcCode: 'L04AA13',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AA - Selective immunosuppressants',
    atcLevel5: 'L04AA13 - Leflunomide',
    commonNames: ['Arava'],
    activeIngredient: 'Leflunomide',
    drugClass: 'DMARD'
  },

  // === BIOLOGICS ===
  {
    id: 'WDD-008',
    drugName: 'Adalimumab',
    atcCode: 'L04AB04',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AB - Tumor necrosis factor alpha (TNF-α) inhibitors',
    atcLevel5: 'L04AB04 - Adalimumab',
    commonNames: ['Humira', 'Amjevita', 'Cyltezo'],
    activeIngredient: 'Adalimumab',
    drugClass: 'TNF Inhibitor Biologic'
  },
  {
    id: 'WDD-009',
    drugName: 'Etanercept',
    atcCode: 'L04AB01',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AB - Tumor necrosis factor alpha (TNF-α) inhibitors',
    atcLevel5: 'L04AB01 - Etanercept',
    commonNames: ['Enbrel', 'Erelzi'],
    activeIngredient: 'Etanercept',
    drugClass: 'TNF Inhibitor Biologic'
  },
  {
    id: 'WDD-010',
    drugName: 'Infliximab',
    atcCode: 'L04AB02',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AB - Tumor necrosis factor alpha (TNF-α) inhibitors',
    atcLevel5: 'L04AB02 - Infliximab',
    commonNames: ['Remicade', 'Inflectra', 'Renflexis'],
    activeIngredient: 'Infliximab',
    drugClass: 'TNF Inhibitor Biologic'
  },
  {
    id: 'WDD-021',
    drugName: 'Tofacitinib',
    atcCode: 'L04AA29',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AA - Selective immunosuppressants',
    atcLevel5: 'L04AA29 - Tofacitinib',
    commonNames: ['Xeljanz', 'Xeljanz XR'],
    activeIngredient: 'Tofacitinib Citrate',
    drugClass: 'JAK Inhibitor'
  },
  {
    id: 'WDD-022',
    drugName: 'Baricitinib',
    atcCode: 'L04AA37',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AA - Selective immunosuppressants',
    atcLevel5: 'L04AA37 - Baricitinib',
    commonNames: ['Olumiant'],
    activeIngredient: 'Baricitinib',
    drugClass: 'JAK Inhibitor'
  },

  // === IMMUNOSUPPRESSANTS ===
  {
    id: 'WDD-016',
    drugName: 'Azathioprine',
    atcCode: 'L04AX01',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AX - Other immunosuppressants',
    atcLevel5: 'L04AX01 - Azathioprine',
    commonNames: ['Imuran', 'Azasan'],
    activeIngredient: 'Azathioprine',
    drugClass: 'Immunosuppressant'
  },
  {
    id: 'WDD-017',
    drugName: 'Cyclosporine',
    atcCode: 'L04AD01',
    atcLevel1: 'L - Antineoplastic and immunomodulating agents',
    atcLevel2: 'L04 - Immunosuppressants',
    atcLevel3: 'L04A - Immunosuppressants',
    atcLevel4: 'L04AD - Calcineurin inhibitors',
    atcLevel5: 'L04AD01 - Cyclosporine',
    commonNames: ['Neoral', 'Sandimmune', 'Gengraf'],
    activeIngredient: 'Cyclosporine',
    drugClass: 'Immunosuppressant'
  },

  // === RESPIRATORY ===
  {
    id: 'WDD-R01',
    drugName: 'Albuterol',
    atcCode: 'R03AC02',
    atcLevel1: 'R - Respiratory system',
    atcLevel2: 'R03 - Drugs for obstructive airway diseases',
    atcLevel3: 'R03A - Adrenergics, inhalants',
    atcLevel4: 'R03AC - Selective beta-2-adrenoreceptor agonists',
    atcLevel5: 'R03AC02 - Salbutamol',
    commonNames: ['ProAir', 'Ventolin', 'Proventil', 'Salbutamol'],
    activeIngredient: 'Albuterol Sulfate',
    drugClass: 'Short-Acting Beta Agonist'
  },
  {
    id: 'WDD-R02',
    drugName: 'Montelukast',
    atcCode: 'R03DC03',
    atcLevel1: 'R - Respiratory system',
    atcLevel2: 'R03 - Drugs for obstructive airway diseases',
    atcLevel3: 'R03D - Other systemic drugs for obstructive airway diseases',
    atcLevel4: 'R03DC - Leukotriene receptor antagonists',
    atcLevel5: 'R03DC03 - Montelukast',
    commonNames: ['Singulair'],
    activeIngredient: 'Montelukast Sodium',
    drugClass: 'Leukotriene Inhibitor'
  },
  {
    id: 'WDD-R03',
    drugName: 'Fluticasone',
    atcCode: 'R03BA05',
    atcLevel1: 'R - Respiratory system',
    atcLevel2: 'R03 - Drugs for obstructive airway diseases',
    atcLevel3: 'R03B - Other drugs for obstructive airway diseases, inhalants',
    atcLevel4: 'R03BA - Glucocorticoids',
    atcLevel5: 'R03BA05 - Fluticasone',
    commonNames: ['Flovent', 'Arnuity', 'Flonase'],
    activeIngredient: 'Fluticasone Propionate',
    drugClass: 'Inhaled Corticosteroid'
  },

  // === ANTIDEPRESSANTS / MENTAL HEALTH ===
  {
    id: 'WDD-M01',
    drugName: 'Sertraline',
    atcCode: 'N06AB06',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N06 - Psychoanaleptics',
    atcLevel3: 'N06A - Antidepressants',
    atcLevel4: 'N06AB - Selective serotonin reuptake inhibitors',
    atcLevel5: 'N06AB06 - Sertraline',
    commonNames: ['Zoloft'],
    activeIngredient: 'Sertraline Hydrochloride',
    drugClass: 'SSRI Antidepressant'
  },
  {
    id: 'WDD-M02',
    drugName: 'Escitalopram',
    atcCode: 'N06AB10',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N06 - Psychoanaleptics',
    atcLevel3: 'N06A - Antidepressants',
    atcLevel4: 'N06AB - Selective serotonin reuptake inhibitors',
    atcLevel5: 'N06AB10 - Escitalopram',
    commonNames: ['Lexapro'],
    activeIngredient: 'Escitalopram Oxalate',
    drugClass: 'SSRI Antidepressant'
  },
  {
    id: 'WDD-M03',
    drugName: 'Fluoxetine',
    atcCode: 'N06AB03',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N06 - Psychoanaleptics',
    atcLevel3: 'N06A - Antidepressants',
    atcLevel4: 'N06AB - Selective serotonin reuptake inhibitors',
    atcLevel5: 'N06AB03 - Fluoxetine',
    commonNames: ['Prozac', 'Sarafem'],
    activeIngredient: 'Fluoxetine Hydrochloride',
    drugClass: 'SSRI Antidepressant'
  },
  {
    id: 'WDD-M04',
    drugName: 'Duloxetine',
    atcCode: 'N06AX21',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N06 - Psychoanaleptics',
    atcLevel3: 'N06A - Antidepressants',
    atcLevel4: 'N06AX - Other antidepressants',
    atcLevel5: 'N06AX21 - Duloxetine',
    commonNames: ['Cymbalta'],
    activeIngredient: 'Duloxetine Hydrochloride',
    drugClass: 'SNRI Antidepressant'
  },
  {
    id: 'WDD-M05',
    drugName: 'Bupropion',
    atcCode: 'N06AX12',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N06 - Psychoanaleptics',
    atcLevel3: 'N06A - Antidepressants',
    atcLevel4: 'N06AX - Other antidepressants',
    atcLevel5: 'N06AX12 - Bupropion',
    commonNames: ['Wellbutrin', 'Zyban'],
    activeIngredient: 'Bupropion Hydrochloride',
    drugClass: 'NDRI Antidepressant'
  },
  {
    id: 'WDD-M06',
    drugName: 'Alprazolam',
    atcCode: 'N05BA12',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N05 - Psycholeptics',
    atcLevel3: 'N05B - Anxiolytics',
    atcLevel4: 'N05BA - Benzodiazepine derivatives',
    atcLevel5: 'N05BA12 - Alprazolam',
    commonNames: ['Xanax'],
    activeIngredient: 'Alprazolam',
    drugClass: 'Benzodiazepine'
  },
  {
    id: 'WDD-M07',
    drugName: 'Lorazepam',
    atcCode: 'N05BA06',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N05 - Psycholeptics',
    atcLevel3: 'N05B - Anxiolytics',
    atcLevel4: 'N05BA - Benzodiazepine derivatives',
    atcLevel5: 'N05BA06 - Lorazepam',
    commonNames: ['Ativan'],
    activeIngredient: 'Lorazepam',
    drugClass: 'Benzodiazepine'
  },

  // === GI MEDICATIONS ===
  {
    id: 'WDD-023',
    drugName: 'Omeprazole',
    atcCode: 'A02BC01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A02 - Drugs for acid related disorders',
    atcLevel3: 'A02B - Drugs for peptic ulcer and GORD',
    atcLevel4: 'A02BC - Proton pump inhibitors',
    atcLevel5: 'A02BC01 - Omeprazole',
    commonNames: ['Prilosec', 'Losec'],
    activeIngredient: 'Omeprazole',
    drugClass: 'Proton Pump Inhibitor'
  },
  {
    id: 'WDD-G01',
    drugName: 'Pantoprazole',
    atcCode: 'A02BC02',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A02 - Drugs for acid related disorders',
    atcLevel3: 'A02B - Drugs for peptic ulcer and GORD',
    atcLevel4: 'A02BC - Proton pump inhibitors',
    atcLevel5: 'A02BC02 - Pantoprazole',
    commonNames: ['Protonix'],
    activeIngredient: 'Pantoprazole Sodium',
    drugClass: 'Proton Pump Inhibitor'
  },
  {
    id: 'WDD-G02',
    drugName: 'Esomeprazole',
    atcCode: 'A02BC05',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A02 - Drugs for acid related disorders',
    atcLevel3: 'A02B - Drugs for peptic ulcer and GORD',
    atcLevel4: 'A02BC - Proton pump inhibitors',
    atcLevel5: 'A02BC05 - Esomeprazole',
    commonNames: ['Nexium'],
    activeIngredient: 'Esomeprazole Magnesium',
    drugClass: 'Proton Pump Inhibitor'
  },
  {
    id: 'WDD-G03',
    drugName: 'Ondansetron',
    atcCode: 'A04AA01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A04 - Antiemetics and antinauseants',
    atcLevel3: 'A04A - Antiemetics and antinauseants',
    atcLevel4: 'A04AA - Serotonin (5HT3) antagonists',
    atcLevel5: 'A04AA01 - Ondansetron',
    commonNames: ['Zofran'],
    activeIngredient: 'Ondansetron',
    drugClass: 'Antiemetic'
  },

  // === ANTIBIOTICS ===
  {
    id: 'WDD-A01',
    drugName: 'Amoxicillin',
    atcCode: 'J01CA04',
    atcLevel1: 'J - Antiinfectives for systemic use',
    atcLevel2: 'J01 - Antibacterials for systemic use',
    atcLevel3: 'J01C - Beta-lactam antibacterials, penicillins',
    atcLevel4: 'J01CA - Penicillins with extended spectrum',
    atcLevel5: 'J01CA04 - Amoxicillin',
    commonNames: ['Amoxil', 'Trimox'],
    activeIngredient: 'Amoxicillin',
    drugClass: 'Penicillin Antibiotic'
  },
  {
    id: 'WDD-A02',
    drugName: 'Azithromycin',
    atcCode: 'J01FA10',
    atcLevel1: 'J - Antiinfectives for systemic use',
    atcLevel2: 'J01 - Antibacterials for systemic use',
    atcLevel3: 'J01F - Macrolides, lincosamides and streptogramins',
    atcLevel4: 'J01FA - Macrolides',
    atcLevel5: 'J01FA10 - Azithromycin',
    commonNames: ['Zithromax', 'Z-Pak'],
    activeIngredient: 'Azithromycin',
    drugClass: 'Macrolide Antibiotic'
  },
  {
    id: 'WDD-A03',
    drugName: 'Ciprofloxacin',
    atcCode: 'J01MA02',
    atcLevel1: 'J - Antiinfectives for systemic use',
    atcLevel2: 'J01 - Antibacterials for systemic use',
    atcLevel3: 'J01M - Quinolone antibacterials',
    atcLevel4: 'J01MA - Fluoroquinolones',
    atcLevel5: 'J01MA02 - Ciprofloxacin',
    commonNames: ['Cipro'],
    activeIngredient: 'Ciprofloxacin',
    drugClass: 'Fluoroquinolone Antibiotic'
  },
  {
    id: 'WDD-A04',
    drugName: 'Doxycycline',
    atcCode: 'J01AA02',
    atcLevel1: 'J - Antiinfectives for systemic use',
    atcLevel2: 'J01 - Antibacterials for systemic use',
    atcLevel3: 'J01A - Tetracyclines',
    atcLevel4: 'J01AA - Tetracyclines',
    atcLevel5: 'J01AA02 - Doxycycline',
    commonNames: ['Vibramycin', 'Doryx'],
    activeIngredient: 'Doxycycline',
    drugClass: 'Tetracycline Antibiotic'
  },

  // === ALLERGY ===
  {
    id: 'WDD-AL01',
    drugName: 'Cetirizine',
    atcCode: 'R06AE07',
    atcLevel1: 'R - Respiratory system',
    atcLevel2: 'R06 - Antihistamines for systemic use',
    atcLevel3: 'R06A - Antihistamines for systemic use',
    atcLevel4: 'R06AE - Piperazine derivatives',
    atcLevel5: 'R06AE07 - Cetirizine',
    commonNames: ['Zyrtec'],
    activeIngredient: 'Cetirizine Hydrochloride',
    drugClass: 'Antihistamine'
  },
  {
    id: 'WDD-AL02',
    drugName: 'Loratadine',
    atcCode: 'R06AX13',
    atcLevel1: 'R - Respiratory system',
    atcLevel2: 'R06 - Antihistamines for systemic use',
    atcLevel3: 'R06A - Antihistamines for systemic use',
    atcLevel4: 'R06AX - Other antihistamines for systemic use',
    atcLevel5: 'R06AX13 - Loratadine',
    commonNames: ['Claritin'],
    activeIngredient: 'Loratadine',
    drugClass: 'Antihistamine'
  },
  {
    id: 'WDD-AL03',
    drugName: 'Diphenhydramine',
    atcCode: 'R06AA02',
    atcLevel1: 'R - Respiratory system',
    atcLevel2: 'R06 - Antihistamines for systemic use',
    atcLevel3: 'R06A - Antihistamines for systemic use',
    atcLevel4: 'R06AA - Aminoalkyl ethers',
    atcLevel5: 'R06AA02 - Diphenhydramine',
    commonNames: ['Benadryl'],
    activeIngredient: 'Diphenhydramine Hydrochloride',
    drugClass: 'Antihistamine'
  },
  {
    id: 'WDD-AL04',
    drugName: 'Fexofenadine',
    atcCode: 'R06AX26',
    atcLevel1: 'R - Respiratory system',
    atcLevel2: 'R06 - Antihistamines for systemic use',
    atcLevel3: 'R06A - Antihistamines for systemic use',
    atcLevel4: 'R06AX - Other antihistamines for systemic use',
    atcLevel5: 'R06AX26 - Fexofenadine',
    commonNames: ['Allegra'],
    activeIngredient: 'Fexofenadine Hydrochloride',
    drugClass: 'Antihistamine'
  },

  // === THYROID ===
  {
    id: 'WDD-T01',
    drugName: 'Levothyroxine',
    atcCode: 'H03AA01',
    atcLevel1: 'H - Systemic hormonal preparations',
    atcLevel2: 'H03 - Thyroid therapy',
    atcLevel3: 'H03A - Thyroid preparations',
    atcLevel4: 'H03AA - Thyroid hormones',
    atcLevel5: 'H03AA01 - Levothyroxine sodium',
    commonNames: ['Synthroid', 'Levoxyl', 'Tirosint'],
    activeIngredient: 'Levothyroxine Sodium',
    drugClass: 'Thyroid Hormone'
  },

  // === VITAMINS/SUPPLEMENTS ===
  {
    id: 'WDD-018',
    drugName: 'Vitamin D3',
    atcCode: 'A11CC05',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A11 - Vitamins',
    atcLevel3: 'A11C - Vitamin A and D, incl. combinations',
    atcLevel4: 'A11CC - Vitamin D and analogues',
    atcLevel5: 'A11CC05 - Colecalciferol',
    commonNames: ['Cholecalciferol', 'Vitamin D', 'D3'],
    activeIngredient: 'Cholecalciferol',
    drugClass: 'Vitamin Supplement'
  },
  {
    id: 'WDD-019',
    drugName: 'Folic Acid',
    atcCode: 'B03BB01',
    atcLevel1: 'B - Blood and blood forming organs',
    atcLevel2: 'B03 - Antianemic preparations',
    atcLevel3: 'B03B - Vitamin B12 and folic acid',
    atcLevel4: 'B03BB - Folic acid and derivatives',
    atcLevel5: 'B03BB01 - Folic acid',
    commonNames: ['Folate', 'Vitamin B9'],
    activeIngredient: 'Folic Acid',
    drugClass: 'Vitamin Supplement'
  },
  {
    id: 'WDD-020',
    drugName: 'Calcium Carbonate',
    atcCode: 'A12AA04',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A12 - Mineral supplements',
    atcLevel3: 'A12A - Calcium',
    atcLevel4: 'A12AA - Calcium',
    atcLevel5: 'A12AA04 - Calcium carbonate',
    commonNames: ['Tums', 'Caltrate', 'Os-Cal'],
    activeIngredient: 'Calcium Carbonate',
    drugClass: 'Mineral Supplement'
  },
  {
    id: 'WDD-V01',
    drugName: 'Vitamin B12',
    atcCode: 'B03BA01',
    atcLevel1: 'B - Blood and blood forming organs',
    atcLevel2: 'B03 - Antianemic preparations',
    atcLevel3: 'B03B - Vitamin B12 and folic acid',
    atcLevel4: 'B03BA - Vitamin B12 (cyanocobalamin and analogues)',
    atcLevel5: 'B03BA01 - Cyanocobalamin',
    commonNames: ['Cyanocobalamin', 'Cobalamin', 'B12'],
    activeIngredient: 'Cyanocobalamin',
    drugClass: 'Vitamin Supplement'
  },
  {
    id: 'WDD-V02',
    drugName: 'Iron Sulfate',
    atcCode: 'B03AA07',
    atcLevel1: 'B - Blood and blood forming organs',
    atcLevel2: 'B03 - Antianemic preparations',
    atcLevel3: 'B03A - Iron preparations',
    atcLevel4: 'B03AA - Iron bivalent, oral preparations',
    atcLevel5: 'B03AA07 - Ferrous sulfate',
    commonNames: ['Ferrous Sulfate', 'Slow Fe', 'Fer-In-Sol'],
    activeIngredient: 'Ferrous Sulfate',
    drugClass: 'Iron Supplement'
  },
  {
    id: 'WDD-V03',
    drugName: 'Magnesium',
    atcCode: 'A12CC',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A12 - Mineral supplements',
    atcLevel3: 'A12C - Other mineral supplements',
    atcLevel4: 'A12CC - Magnesium',
    atcLevel5: 'A12CC - Magnesium',
    commonNames: ['Mag-Ox', 'Slow-Mag', 'Magnesium Citrate'],
    activeIngredient: 'Magnesium',
    drugClass: 'Mineral Supplement'
  },
  {
    id: 'WDD-V04',
    drugName: 'Potassium Chloride',
    atcCode: 'A12BA01',
    atcLevel1: 'A - Alimentary tract and metabolism',
    atcLevel2: 'A12 - Mineral supplements',
    atcLevel3: 'A12B - Potassium',
    atcLevel4: 'A12BA - Potassium',
    atcLevel5: 'A12BA01 - Potassium chloride',
    commonNames: ['K-Dur', 'Klor-Con', 'KCl'],
    activeIngredient: 'Potassium Chloride',
    drugClass: 'Electrolyte Supplement'
  },
];

// Helper function to search drugs
export const searchDrugs = (query: string): WHODrug[] => {
  const lowerQuery = query.toLowerCase();
  return whoDrugDictionary.filter(drug => 
    drug.drugName.toLowerCase().includes(lowerQuery) ||
    drug.commonNames.some(name => name.toLowerCase().includes(lowerQuery)) ||
    drug.activeIngredient.toLowerCase().includes(lowerQuery) ||
    drug.drugClass.toLowerCase().includes(lowerQuery) ||
    drug.atcCode.toLowerCase().includes(lowerQuery)
  );
};

// Get drug by exact name
export const getDrugByName = (name: string): WHODrug | undefined => {
  return whoDrugDictionary.find(drug =>
    drug.drugName.toLowerCase() === name.toLowerCase() ||
    drug.commonNames.some(cn => cn.toLowerCase() === name.toLowerCase())
  );
};

// Get drugs by ATC classification
export const getDrugsByATCClass = (atcLevel: string): WHODrug[] => {
  return whoDrugDictionary.filter(drug =>
    drug.atcLevel1.includes(atcLevel) ||
    drug.atcLevel2.includes(atcLevel) ||
    drug.atcLevel3.includes(atcLevel) ||
    drug.atcCode.startsWith(atcLevel)
  );
};
