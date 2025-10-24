// WHO Drug Dictionary Global (WHODD) - Simplified subset for demonstration
// In production, this would connect to the actual WHODD API or database
// ATC Classification System integrated

export interface WHODrug {
  id: string;
  drugName: string;
  atcCode: string;
  atcLevel1: string; // Anatomical main group
  atcLevel2: string; // Therapeutic subgroup  
  atcLevel3: string; // Pharmacological subgroup
  atcLevel4: string; // Chemical subgroup
  atcLevel5: string; // Chemical substance
  commonNames: string[];
  activeIngredient: string;
  drugClass: string;
}

// Comprehensive WHO Drug Dictionary subset focusing on common medications
// for chronic conditions, autoimmune diseases, and symptom management
export const whoDrugDictionary: WHODrug[] = [
  // NSAIDs - Anti-inflammatory agents
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

  // DMARDs - Disease-Modifying Antirheumatic Drugs
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

  // Biologics - TNF Inhibitors
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

  // Corticosteroids
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

  // Pain Management
  {
    id: 'WDD-013',
    drugName: 'Acetaminophen',
    atcCode: 'N02BE01',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N02 - Analgesics',
    atcLevel3: 'N02B - Other analgesics and antipyretics',
    atcLevel4: 'N02BE - Anilides',
    atcLevel5: 'N02BE01 - Paracetamol',
    commonNames: ['Tylenol', 'Paracetamol', 'APAP'],
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

  // Immunosuppressants
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

  // Supplements and Vitamins commonly used
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

  // JAK Inhibitors (newer biologics)
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

  // Additional common medications
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
    id: 'WDD-024',
    drugName: 'Aspirin',
    atcCode: 'N02BA01',
    atcLevel1: 'N - Nervous system',
    atcLevel2: 'N02 - Analgesics',
    atcLevel3: 'N02B - Other analgesics and antipyretics',
    atcLevel4: 'N02BA - Salicylic acid and derivatives',
    atcLevel5: 'N02BA01 - Acetylsalicylic acid',
    commonNames: ['ASA', 'Bayer Aspirin', 'Ecotrin'],
    activeIngredient: 'Acetylsalicylic Acid',
    drugClass: 'NSAID/Antiplatelet'
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
  }
];

// Helper function to search drugs
export const searchDrugs = (query: string): WHODrug[] => {
  const lowerQuery = query.toLowerCase();
  return whoDrugDictionary.filter(drug => 
    drug.drugName.toLowerCase().includes(lowerQuery) ||
    drug.commonNames.some(name => name.toLowerCase().includes(lowerQuery)) ||
    drug.activeIngredient.toLowerCase().includes(lowerQuery) ||
    drug.drugClass.toLowerCase().includes(lowerQuery)
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
    drug.atcLevel3.includes(atcLevel)
  );
};