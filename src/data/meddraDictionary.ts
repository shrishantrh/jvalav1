// MedDRA (Medical Dictionary for Regulatory Activities) - Simplified subset
// In production, this would use the full licensed MedDRA database
// Hierarchical structure: SOC -> HLGT -> HLT -> PT -> LLT

export interface MedDRATerm {
  code: string;
  term: string;
  level: 'SOC' | 'HLGT' | 'HLT' | 'PT' | 'LLT';
  parentCode?: string;
  soc: string; // System Organ Class
}

// System Organ Classes (SOC) - Top level
export const medDRASystemOrganClasses = [
  { code: 'SOC-10029205', term: 'Musculoskeletal and connective tissue disorders' },
  { code: 'SOC-10028395', term: 'Nervous system disorders' },
  { code: 'SOC-10018065', term: 'General disorders and administration site conditions' },
  { code: 'SOC-10037175', term: 'Psychiatric disorders' },
  { code: 'SOC-10017947', term: 'Gastrointestinal disorders' },
  { code: 'SOC-10040785', term: 'Skin and subcutaneous tissue disorders' },
  { code: 'SOC-10015919', term: 'Cardiac disorders' },
  { code: 'SOC-10038738', term: 'Respiratory, thoracic and mediastinal disorders' },
  { code: 'SOC-10027433', term: 'Metabolism and nutrition disorders' },
];

// Common MedDRA Preferred Terms (PT) for chronic conditions
export const meddraDictionary: MedDRATerm[] = [
  // Musculoskeletal disorders - Joint related
  {
    code: 'PT-10001284',
    term: 'Arthralgia',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'LLT-10003239',
    term: 'Joint pain',
    level: 'LLT',
    parentCode: 'PT-10001284',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'LLT-10024934',
    term: 'Knee pain',
    level: 'LLT',
    parentCode: 'PT-10001284',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'PT-10003246',
    term: 'Joint swelling',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'PT-10028227',
    term: 'Morning stiffness',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'PT-10040013',
    term: 'Joint stiffness',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },

  // Musculoskeletal - Muscle related
  {
    code: 'PT-10028411',
    term: 'Myalgia',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'LLT-10028378',
    term: 'Muscle pain',
    level: 'LLT',
    parentCode: 'PT-10028411',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'PT-10028334',
    term: 'Muscle stiffness',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'PT-10028372',
    term: 'Muscle spasms',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },
  {
    code: 'PT-10028390',
    term: 'Muscle weakness',
    level: 'PT',
    soc: 'Musculoskeletal and connective tissue disorders'
  },

  // General disorders - Fatigue and malaise
  {
    code: 'PT-10016256',
    term: 'Fatigue',
    level: 'PT',
    soc: 'General disorders and administration site conditions'
  },
  {
    code: 'LLT-10016275',
    term: 'Tiredness',
    level: 'LLT',
    parentCode: 'PT-10016256',
    soc: 'General disorders and administration site conditions'
  },
  {
    code: 'LLT-10026445',
    term: 'Lack of energy',
    level: 'LLT',
    parentCode: 'PT-10016256',
    soc: 'General disorders and administration site conditions'
  },
  {
    code: 'PT-10026989',
    term: 'Malaise',
    level: 'PT',
    soc: 'General disorders and administration site conditions'
  },
  {
    code: 'PT-10001430',
    term: 'Asthenia',
    level: 'PT',
    soc: 'General disorders and administration site conditions'
  },

  // Nervous system - Pain
  {
    code: 'PT-10033371',
    term: 'Pain',
    level: 'PT',
    soc: 'Nervous system disorders'
  },
  {
    code: 'PT-10019211',
    term: 'Headache',
    level: 'PT',
    soc: 'Nervous system disorders'
  },
  {
    code: 'LLT-10027596',
    term: 'Migraine',
    level: 'LLT',
    parentCode: 'PT-10019211',
    soc: 'Nervous system disorders'
  },
  {
    code: 'PT-10013573',
    term: 'Dizziness',
    level: 'PT',
    soc: 'Nervous system disorders'
  },
  {
    code: 'PT-10029864',
    term: 'Neuropathy peripheral',
    level: 'PT',
    soc: 'Nervous system disorders'
  },

  // Psychiatric - Mood and sleep
  {
    code: 'PT-10022437',
    term: 'Insomnia',
    level: 'PT',
    soc: 'Psychiatric disorders'
  },
  {
    code: 'LLT-10041144',
    term: 'Sleep disturbance',
    level: 'LLT',
    parentCode: 'PT-10022437',
    soc: 'Psychiatric disorders'
  },
  {
    code: 'PT-10012378',
    term: 'Depression',
    level: 'PT',
    soc: 'Psychiatric disorders'
  },
  {
    code: 'PT-10001976',
    term: 'Anxiety',
    level: 'PT',
    soc: 'Psychiatric disorders'
  },
  {
    code: 'PT-10042458',
    term: 'Stress',
    level: 'PT',
    soc: 'Psychiatric disorders'
  },

  // Gastrointestinal
  {
    code: 'PT-10028813',
    term: 'Nausea',
    level: 'PT',
    soc: 'Gastrointestinal disorders'
  },
  {
    code: 'PT-10000081',
    term: 'Abdominal pain',
    level: 'PT',
    soc: 'Gastrointestinal disorders'
  },
  {
    code: 'PT-10013946',
    term: 'Diarrhoea',
    level: 'PT',
    soc: 'Gastrointestinal disorders'
  },
  {
    code: 'PT-10011968',
    term: 'Constipation',
    level: 'PT',
    soc: 'Gastrointestinal disorders'
  },

  // Skin and subcutaneous tissue
  {
    code: 'PT-10037087',
    term: 'Rash',
    level: 'PT',
    soc: 'Skin and subcutaneous tissue disorders'
  },
  {
    code: 'PT-10037087',
    term: 'Pruritus',
    level: 'PT',
    soc: 'Skin and subcutaneous tissue disorders'
  },
  {
    code: 'LLT-10022891',
    term: 'Itching',
    level: 'LLT',
    parentCode: 'PT-10037087',
    soc: 'Skin and subcutaneous tissue disorders'
  },

  // Respiratory
  {
    code: 'PT-10013963',
    term: 'Dyspnoea',
    level: 'PT',
    soc: 'Respiratory, thoracic and mediastinal disorders'
  },
  {
    code: 'LLT-10041237',
    term: 'Shortness of breath',
    level: 'LLT',
    parentCode: 'PT-10013963',
    soc: 'Respiratory, thoracic and mediastinal disorders'
  },
  {
    code: 'PT-10011920',
    term: 'Cough',
    level: 'PT',
    soc: 'Respiratory, thoracic and mediastinal disorders'
  },

  // Cardiac
  {
    code: 'PT-10033557',
    term: 'Palpitations',
    level: 'PT',
    soc: 'Cardiac disorders'
  },
  {
    code: 'PT-10007554',
    term: 'Chest pain',
    level: 'PT',
    soc: 'Cardiac disorders'
  },

  // Metabolism
  {
    code: 'PT-10000540',
    term: 'Decreased appetite',
    level: 'PT',
    soc: 'Metabolism and nutrition disorders'
  },
  {
    code: 'PT-10022498',
    term: 'Increased appetite',
    level: 'PT',
    soc: 'Metabolism and nutrition disorders'
  },
];

// Helper functions
export const searchMedDRATerms = (query: string): MedDRATerm[] => {
  const lowerQuery = query.toLowerCase();
  return meddraDictionary.filter(term =>
    term.term.toLowerCase().includes(lowerQuery)
  );
};

export const getMedDRAByCode = (code: string): MedDRATerm | undefined => {
  return meddraDictionary.find(term => term.code === code);
};

export const getSOCForTerm = (termCode: string): string => {
  const term = meddraDictionary.find(t => t.code === termCode);
  return term?.soc || 'General disorders and administration site conditions';
};

export const getPTsForSOC = (soc: string): MedDRATerm[] => {
  return meddraDictionary.filter(term => 
    term.soc === soc && term.level === 'PT'
  );
};