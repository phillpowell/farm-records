// All on-screen wording, in English and Nepali.
// To change a translation, edit the text here and push the change to GitHub.
// Each entry is [English, Nepali].

export const T = {
  appName: ['Farm Records', 'फार्म रेकर्ड'],

  // Event types
  Arrival: ['New arrival', 'नयाँ आगमन'],
  Birth: ['Birth', 'जन्म'],
  Treatment: ['Treatment / vaccine', 'उपचार / खोप'],
  Weight: ['Weight', 'तौल'],
  'Death/Loss': ['Death / loss', 'मृत्यु / क्षति'],
  Sale: ['Sale', 'बिक्री'],

  // Home screen
  whatHappened: ['What do you want to record?', 'के रेकर्ड गर्ने?'],
  animals: ['Animals & birds', 'पशुपन्छी'],
  recent: ['Recent entries', 'हालका रेकर्डहरू'],
  settings: ['Settings', 'सेटिङ'],

  // Form fields
  eventDate: ['Date', 'मिति'],
  species: ['Animal type', 'पशुपन्छीको किसिम'],
  tagNo: ['Tag number', 'ट्याग नम्बर'],
  batchNo: ['Batch number', 'ब्याच नम्बर'],
  tagOrLitter: ['Tag or litter number', 'ट्याग वा बेतको नम्बर'],
  animalOrBatch: ['Which animal / batch?', 'कुन पशु / ब्याच?'],
  breed: ['Breed', 'जात'],
  sex: ['Sex', 'लिङ्ग'],
  Male: ['Male', 'भाले'],
  Female: ['Female', 'पोथी'],
  Unknown: ['Unknown', 'थाहा छैन'],
  count: ['How many', 'कति वटा'],
  countSex: ['Count / sex', 'संख्या / लिङ्ग'],
  countBorn: ['How many born alive', 'कति वटा जीवित जन्मिए'],
  countDied: ['How many died / lost', 'कति वटा मरे / हराए'],
  countSold: ['How many sold', 'कति वटा बेचियो'],
  motherId: ['Mother tag number', 'आमाको ट्याग नम्बर'],
  source: ['Bought from / source', 'कहाँबाट ल्याइयो'],
  price: ['Total price paid (NPR)', 'जम्मा तिरेको मूल्य (रु.)'],
  treatmentType: ['Treatment type', 'उपचारको किसिम'],
  medicine: ['Medicine / product name', 'औषधि / सामग्रीको नाम'],
  weightKg: ['Weight (kg)', 'तौल (केजी)'],
  cause: ['Cause', 'कारण'],
  buyer: ['Buyer', 'किन्ने व्यक्ति'],
  salePrice: ['Total sale price (NPR)', 'जम्मा बिक्री मूल्य (रु.)'],
  notes: ['Notes', 'टिप्पणी'],
  photo: ['Photo', 'फोटो'],
  recordedBy: ['Your name', 'तपाईंको नाम'],
  optional: ['optional', 'ऐच्छिक'],
  choose: ['Choose…', 'छान्नुहोस्…'],

  // Hints
  hintBatchWeight: ['For a batch, weigh a few and enter the average.', 'ब्याचको लागि केही तौलेर औसत लेख्नुहोस्।'],
  hintBatchExists: ['This batch already exists – these will be added to it.', 'यो ब्याच पहिले नै छ – यी त्यसमै थपिनेछन्।'],
  hintLitter: ['For a litter, enter one number for the whole litter.', 'बेतको लागि पूरै बेतलाई एउटा नम्बर दिनुहोस्।'],
  hintLeft: ['left', 'बाँकी'],
  noActive: ['No live animals of this type yet. Record a new arrival first.', 'यो किसिमका जीवित पशु अहिले छैनन्। पहिले नयाँ आगमन रेकर्ड गर्नुहोस्।'],
  addPhoto: ['Add photo', 'फोटो थप्नुहोस्'],
  removePhoto: ['Remove photo', 'फोटो हटाउनुहोस्'],

  // Buttons and messages
  save: ['Save', 'सेभ गर्नुहोस्'],
  cancel: ['Cancel', 'रद्द गर्नुहोस्'],
  back: ['Back', 'पछाडि'],
  saved: ['Saved', 'सेभ भयो'],
  delete: ['Delete', 'मेटाउनुहोस्'],
  required: ['Please fill this in', 'कृपया यो भर्नुहोस्'],
  tagInUse: ['This number is already in use for a live animal', 'यो नम्बर जीवित पशुको लागि पहिले नै प्रयोगमा छ'],
  tooMany: ['That is more than are left in this batch', 'यो ब्याचमा बाँकी भन्दा धेरै भयो'],
  mustBePositive: ['Enter a number above 0', '० भन्दा बढी संख्या लेख्नुहोस्'],
  futureDate: ['Date cannot be in the future', 'मिति भविष्यको हुन सक्दैन'],
  confirmDelete: ['Delete this entry? It has not been uploaded yet.', 'यो रेकर्ड मेटाउने? यो अझै अपलोड भएको छैन।'],

  // Sync status
  allUploaded: ['All uploaded', 'सबै अपलोड भयो'],
  waiting: ['waiting to upload', 'अपलोड हुन बाँकी'],
  uploading: ['Uploading…', 'अपलोड हुँदैछ…'],
  offline: ['No internet – saved on this computer', 'इन्टरनेट छैन – यही कम्प्युटरमा सेभ छ'],
  notSetUp: ['Not connected – see Settings', 'जोडिएको छैन – सेटिङ हेर्नुहोस्'],
  badKey: ['Farm key is wrong – see Settings', 'फार्म की मिलेन – सेटिङ हेर्नुहोस्'],
  syncError: ['Upload problem – will retry', 'अपलोडमा समस्या – फेरि प्रयास हुनेछ'],
  lastSync: ['Last upload', 'अन्तिम अपलोड'],
  syncNow: ['Upload now', 'अहिले अपलोड गर्नुहोस्'],
  pendingBadge: ['Not uploaded yet', 'अझै अपलोड भएको छैन'],

  // Animals screen
  status: ['Status', 'अवस्था'],
  Active: ['Alive', 'जीवित'],
  Dead: ['Dead / lost', 'मृत / हराएको'],
  Sold: ['Sold', 'बेचिएको'],
  all: ['All', 'सबै'],
  search: ['Search tag / batch / breed', 'ट्याग / ब्याच / जात खोज्नुहोस्'],
  liveNow: ['Alive now', 'अहिले जीवित'],
  nothingHere: ['Nothing here yet.', 'अहिलेसम्म केही छैन।'],
  history: ['History', 'इतिहास'],
  started: ['Started', 'सुरु'],
  startedWith: ['Started with', 'सुरुमा'],
  lastWeight: ['Last weight', 'अन्तिम तौल'],
  lastTreatment: ['Last treatment', 'अन्तिम उपचार'],
  Individual: ['Individual', 'एक-एक गरी'],
  Batch: ['Batch', 'ब्याच'],

  // Settings screen
  serverUrl: ['Server address (Google web app URL)', 'सर्भर ठेगाना'],
  farmKey: ['Farm key', 'फार्म की'],
  deviceName: ['This computer\'s name', 'यो कम्प्युटरको नाम'],
  saveSettings: ['Save & test connection', 'सेभ गरेर जाँच्नुहोस्'],
  connected: ['Connected', 'जोडियो'],
  setupDone: ['This computer is now connected to the farm records.', 'यो कम्प्युटर फार्म रेकर्डसँग जोडियो।'],
  version: ['App version', 'एप संस्करण'],
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Bilingual label as HTML: English on top, Nepali underneath. */
export function bi(key) {
  const [en, ne] = T[key] || [key, ''];
  return `<span class="en">${esc(en)}</span>${ne ? `<span class="ne">${esc(ne)}</span>` : ''}`;
}

/** Bilingual label as plain text on one line (for dropdowns, alerts and the page title). */
export function txt(key) {
  const [en, ne] = T[key] || [key, ''];
  return ne ? `${en} / ${ne}` : en;
}

/** Same as txt() but for an item from the Settings sheet ({en, ne}). */
export function itemText(item) {
  return item.ne ? `${item.en} / ${item.ne}` : item.en;
}

export { esc };
