// Curated chronic conditions database with associated symptoms and triggers
export interface Condition {
  id: string;
  name: string;
  icd10?: string;
  category: string;
  commonSymptoms: string[];
  commonTriggers: string[];
}

export const CONDITIONS: Condition[] = [
  // Autoimmune
  {
    id: 'lupus',
    name: 'Lupus (SLE)',
    icd10: 'M32.9',
    category: 'Autoimmune',
    commonSymptoms: ['Fatigue', 'Joint pain', 'Skin rash', 'Fever', 'Hair loss', 'Photosensitivity', 'Brain fog', 'Mouth sores'],
    commonTriggers: ['Sun exposure', 'Stress', 'Infections', 'Certain medications', 'Lack of sleep']
  },
  {
    id: 'rheumatoid-arthritis',
    name: 'Rheumatoid Arthritis',
    icd10: 'M06.9',
    category: 'Autoimmune',
    commonSymptoms: ['Joint pain', 'Joint swelling', 'Morning stiffness', 'Fatigue', 'Fever', 'Loss of appetite'],
    commonTriggers: ['Cold weather', 'Stress', 'Overexertion', 'Infections', 'Certain foods']
  },
  {
    id: 'psoriatic-arthritis',
    name: 'Psoriatic Arthritis',
    icd10: 'L40.50',
    category: 'Autoimmune',
    commonSymptoms: ['Joint pain', 'Skin plaques', 'Nail changes', 'Swollen fingers', 'Lower back pain', 'Fatigue'],
    commonTriggers: ['Skin injury', 'Stress', 'Cold weather', 'Infections', 'Alcohol']
  },
  {
    id: 'ms',
    name: 'Multiple Sclerosis (MS)',
    icd10: 'G35',
    category: 'Autoimmune',
    commonSymptoms: ['Fatigue', 'Numbness', 'Vision problems', 'Balance issues', 'Brain fog', 'Muscle spasms', 'Pain'],
    commonTriggers: ['Heat', 'Stress', 'Infections', 'Lack of sleep', 'Overexertion']
  },
  {
    id: 'crohns',
    name: "Crohn's Disease",
    icd10: 'K50.9',
    category: 'Autoimmune',
    commonSymptoms: ['Abdominal pain', 'Diarrhea', 'Fatigue', 'Weight loss', 'Nausea', 'Fever', 'Blood in stool'],
    commonTriggers: ['Certain foods', 'Stress', 'NSAIDs', 'Smoking', 'Antibiotics']
  },
  {
    id: 'ulcerative-colitis',
    name: 'Ulcerative Colitis',
    icd10: 'K51.9',
    category: 'Autoimmune',
    commonSymptoms: ['Bloody diarrhea', 'Abdominal cramping', 'Urgency', 'Fatigue', 'Weight loss', 'Fever'],
    commonTriggers: ['Dairy', 'High-fiber foods', 'Stress', 'NSAIDs', 'Missed medications']
  },
  {
    id: 'hashimotos',
    name: "Hashimoto's Thyroiditis",
    icd10: 'E06.3',
    category: 'Autoimmune',
    commonSymptoms: ['Fatigue', 'Weight gain', 'Cold sensitivity', 'Brain fog', 'Hair loss', 'Dry skin', 'Depression'],
    commonTriggers: ['Stress', 'Gluten', 'Soy', 'Iodine excess', 'Infections']
  },
  // Chronic Pain
  {
    id: 'fibromyalgia',
    name: 'Fibromyalgia',
    icd10: 'M79.7',
    category: 'Chronic Pain',
    commonSymptoms: ['Widespread pain', 'Fatigue', 'Brain fog', 'Sleep problems', 'Headaches', 'IBS symptoms', 'Sensitivity to touch'],
    commonTriggers: ['Weather changes', 'Stress', 'Poor sleep', 'Overexertion', 'Certain foods']
  },
  {
    id: 'chronic-fatigue',
    name: 'Chronic Fatigue Syndrome (ME/CFS)',
    icd10: 'R53.82',
    category: 'Chronic Pain',
    commonSymptoms: ['Severe fatigue', 'Post-exertional malaise', 'Brain fog', 'Sleep dysfunction', 'Pain', 'Dizziness'],
    commonTriggers: ['Physical exertion', 'Mental exertion', 'Stress', 'Infections', 'Poor sleep']
  },
  {
    id: 'migraine',
    name: 'Migraine',
    icd10: 'G43.9',
    category: 'Neurological',
    commonSymptoms: ['Severe headache', 'Nausea', 'Light sensitivity', 'Sound sensitivity', 'Visual aura', 'Dizziness'],
    commonTriggers: ['Stress', 'Certain foods', 'Hormonal changes', 'Weather changes', 'Lack of sleep', 'Dehydration']
  },
  {
    id: 'pots',
    name: 'POTS (Dysautonomia)',
    icd10: 'I49.8',
    category: 'Neurological',
    commonSymptoms: ['Racing heart', 'Dizziness', 'Fainting', 'Fatigue', 'Brain fog', 'Exercise intolerance', 'Nausea'],
    commonTriggers: ['Standing', 'Heat', 'Dehydration', 'Large meals', 'Alcohol', 'Menstruation']
  },
  {
    id: 'endometriosis',
    name: 'Endometriosis',
    icd10: 'N80.9',
    category: 'Reproductive',
    commonSymptoms: ['Pelvic pain', 'Painful periods', 'Pain during intercourse', 'Fatigue', 'Bloating', 'Infertility'],
    commonTriggers: ['Menstruation', 'Ovulation', 'Certain foods', 'Stress', 'Physical activity']
  },
  {
    id: 'pcos',
    name: 'PCOS',
    icd10: 'E28.2',
    category: 'Reproductive',
    commonSymptoms: ['Irregular periods', 'Weight gain', 'Acne', 'Hair growth', 'Hair loss', 'Fatigue', 'Mood changes'],
    commonTriggers: ['High sugar foods', 'Stress', 'Lack of sleep', 'Inactivity', 'Certain medications']
  },
  {
    id: 'asthma',
    name: 'Asthma',
    icd10: 'J45.9',
    category: 'Respiratory',
    commonSymptoms: ['Wheezing', 'Shortness of breath', 'Chest tightness', 'Coughing', 'Difficulty sleeping'],
    commonTriggers: ['Allergens', 'Cold air', 'Exercise', 'Smoke', 'Strong odors', 'Respiratory infections']
  },
  {
    id: 'ibs',
    name: 'Irritable Bowel Syndrome (IBS)',
    icd10: 'K58.9',
    category: 'Gastrointestinal',
    commonSymptoms: ['Abdominal pain', 'Bloating', 'Diarrhea', 'Constipation', 'Gas', 'Cramping'],
    commonTriggers: ['Certain foods', 'Stress', 'Hormonal changes', 'Large meals', 'Alcohol', 'Caffeine']
  },
  {
    id: 'gerd',
    name: 'GERD (Acid Reflux)',
    icd10: 'K21.0',
    category: 'Gastrointestinal',
    commonSymptoms: ['Heartburn', 'Regurgitation', 'Chest pain', 'Difficulty swallowing', 'Chronic cough', 'Hoarseness'],
    commonTriggers: ['Spicy foods', 'Fatty foods', 'Alcohol', 'Caffeine', 'Lying down after eating', 'Large meals']
  },
  {
    id: 'diabetes-type1',
    name: 'Type 1 Diabetes',
    icd10: 'E10.9',
    category: 'Metabolic',
    commonSymptoms: ['High blood sugar', 'Low blood sugar', 'Fatigue', 'Frequent urination', 'Thirst', 'Blurred vision'],
    commonTriggers: ['Missed insulin', 'Illness', 'Stress', 'Carbohydrate intake', 'Exercise timing']
  },
  {
    id: 'diabetes-type2',
    name: 'Type 2 Diabetes',
    icd10: 'E11.9',
    category: 'Metabolic',
    commonSymptoms: ['High blood sugar', 'Fatigue', 'Frequent urination', 'Thirst', 'Slow healing', 'Numbness'],
    commonTriggers: ['High carb foods', 'Stress', 'Inactivity', 'Missed medications', 'Illness']
  },
  {
    id: 'long-covid',
    name: 'Long COVID',
    icd10: 'U09.9',
    category: 'Post-Viral',
    commonSymptoms: ['Fatigue', 'Brain fog', 'Shortness of breath', 'Heart palpitations', 'Joint pain', 'Sleep problems', 'Loss of smell'],
    commonTriggers: ['Physical exertion', 'Mental exertion', 'Stress', 'Poor sleep', 'Alcohol']
  },
  {
    id: 'anxiety',
    name: 'Anxiety Disorder',
    icd10: 'F41.9',
    category: 'Mental Health',
    commonSymptoms: ['Racing thoughts', 'Restlessness', 'Rapid heartbeat', 'Sweating', 'Difficulty concentrating', 'Sleep problems'],
    commonTriggers: ['Stress', 'Caffeine', 'Social situations', 'Work pressure', 'Health concerns', 'News/media']
  },
  {
    id: 'depression',
    name: 'Depression',
    icd10: 'F32.9',
    category: 'Mental Health',
    commonSymptoms: ['Low mood', 'Loss of interest', 'Fatigue', 'Sleep changes', 'Appetite changes', 'Difficulty concentrating'],
    commonTriggers: ['Stress', 'Life changes', 'Isolation', 'Lack of sleep', 'Seasonal changes', 'Relationship issues']
  },
  {
    id: 'eczema',
    name: 'Eczema (Atopic Dermatitis)',
    icd10: 'L20.9',
    category: 'Skin',
    commonSymptoms: ['Itchy skin', 'Dry skin', 'Red patches', 'Cracked skin', 'Bumps', 'Swelling'],
    commonTriggers: ['Dry air', 'Harsh soaps', 'Stress', 'Allergens', 'Sweat', 'Certain fabrics']
  },
  {
    id: 'psoriasis',
    name: 'Psoriasis',
    icd10: 'L40.9',
    category: 'Skin',
    commonSymptoms: ['Red patches', 'Silvery scales', 'Itching', 'Burning', 'Dry cracked skin', 'Nail changes'],
    commonTriggers: ['Stress', 'Skin injury', 'Cold weather', 'Infections', 'Alcohol', 'Certain medications']
  }
];

export const CONDITION_CATEGORIES = [...new Set(CONDITIONS.map(c => c.category))];

// Get all unique symptoms across all conditions
export const ALL_SYMPTOMS = [...new Set(CONDITIONS.flatMap(c => c.commonSymptoms))].sort();

// Get all unique triggers across all conditions
export const ALL_TRIGGERS = [...new Set(CONDITIONS.flatMap(c => c.commonTriggers))].sort();
