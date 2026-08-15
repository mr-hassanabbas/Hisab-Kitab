export interface GuideLink {
  label: string;
  href: string;
}

export interface GuideResponse {
  answer: string;
  links?: GuideLink[];
}

export interface GuideKbSection {
  page: string;
  titleUr: string;
  keywords: string[];
  content: string;
}

export interface GuideStats {
  projectCount: number;
}

const KB_OVERRIDE_KEY = "hk_kb_overrides";

export function getKbOverrides(): Record<string, Partial<GuideKbSection>> {
  try {
    const raw = localStorage.getItem(KB_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

export function saveKbOverride(page: string, section: Partial<GuideKbSection>) {
  try {
    const overrides = getKbOverrides();
    overrides[page] = section;
    localStorage.setItem(KB_OVERRIDE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}

export function resetKbOverride(page: string) {
  try {
    const overrides = getKbOverrides();
    delete overrides[page];
    localStorage.setItem(KB_OVERRIDE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}

export function getEffectiveKb(): GuideKbSection[] {
  const overrides = getKbOverrides();
  return GUIDE_KB.map((s) => (overrides[s.page] ? { ...s, ...overrides[s.page] } : s));
}

export const GUIDE_KB: GuideKbSection[] = [
  {
    page: "/dashboard",
    titleUr: "ڈیش بورڈ",
    keywords: ["dashboard", "home", "start", "شروع", "ڈیش", "ہوم", "mukhtasar", "خلاصہ", "summary", "kya hai", "app kya", "ایپ کیسے"],
    content: `Hisab Kitab ایک تعمیراتی کاموں کی ایپ ہے۔ اس میں آپ پروجیکٹ، مزدور، مواد، اخراجات، مشینری، حاضری، ڈائری، ادائیگیاں اور رپورٹس رکھ سکتے ہیں۔
ڈیش بورڈ پر آپ کو تمام پروجیکٹوں کا خلاصہ نظر آتا ہے: کل پروجیکٹ، کل خرچہ، کل ادائیگیاں، آج کی حاضری وغیرہ۔
پہلے قدم کے طور پر: سائیڈ بار میں "پروجیکٹس" پر جا کر پہلا پروجیکٹ بنائیں۔ پھر اس میں مزدور، مواد اور اخراجات شامل کریں۔ شام کو حاضری لگائیں اور ہفتے کے آخر میں ہفتہ وار ادائیگی بنائیں۔`,
  },
  {
    page: "/projects",
    titleUr: "پروجیکٹ بنانا اور دیکھنا",
    keywords: ["project", "projects", "پراجیکٹ", "پروجیکٹ", "banao", "بنائیں", "create", "new", "نیا", "start", "مالک", "owner", "location", "جگہ", "رقم", "amount", "ڈھا", "villa", "site"],
    content: `نیا پروجیکٹ بنانے کے لیے "پروجیکٹس" صفحے پر "+ نیا پروجیکٹ" بٹن دبائیں۔ فارم میں پروجیکٹ کا نام، مالک کا نام، جگہ (لوکیشن) اور کل رقم (کنٹریکٹ ایماؤنٹ) بھریں اور محفوظ کریں۔
پروجیکٹ کی تفصیل دیکھنے کے لیے پروجیکٹ کے نام پر کلک کریں — وہاں مزدور، مواد، اخراجات اور مشینری سب ایک جگہ مل جائے گا۔
پروجیکٹ کے نام پر کلک کر کے اس کے اندر "لیبر" ٹیب میں موجودہ مزدور دیکھیں اور نئے مزدور پروجیکٹ سے جوڑیں۔`,
  },
  {
    page: "/labour",
    titleUr: "مزدور شامل کرنا",
    keywords: ["labour", "labor", "مزدور", "مزور", "worker", "add labour", "نیا مزدور", "لیبر", "daily wage", "اجرت", "اُجرت", "wage", "کام کرنے والا", "kamm", "kam karne"],
    content: `نیا مزدور بنانے کے لیے "لیبر" صفحے پر "+ لیبر" بٹن دبائیں۔ نام، موبائل نمبر، سی این آئی سی، والد کا نام، گاؤں اور روزانہ اجرت (daily wage) بھریں۔
مزدور بنانے کے بعد اسے پروجیکٹ سے جوڑنے کے لیے متعلقہ پروجیکٹ کے صفحے پر جائیں، "لیبر" ٹیب کھولیں اور "لیبر شامل کریں" سے اس مزدور کو منتخب کریں۔
آپ لیبر صفحے پر سرچ باکس سے مزدور تلاش کر سکتے ہیں اور سوئچ سے مزدور کو فعال/غیر فعال کر سکتے ہیں۔`,
  },
  {
    page: "/attendance",
    titleUr: "حاضری لگانا",
    keywords: ["attendance", "حاضری", "hazri", "حاضر", "present", "غیر حاضر", "absent", "لیٹ", "late", "چھٹی", "leave", "mark", "لگاؤ", "لگانا"],
    content: `حاضری لگانے کے لیے "اٹینڈنس" صفحے پر پروجیکٹ منتخب کریں اور تاریخ چنیں۔ پروجیکٹ کے تمام مزدور نظر آئیں گے۔ ہر مزدور کے سامنے اس کی حالت چنیں: حاضر، غیر حاضر، لیٹ یا چھٹی۔
پھر "محفوظ کریں" دبائیں۔ آج کی حاضری دوبارہ دیکھنے کے لیے ڈیش بورڈ پر "آج کی حاضری" سیکشن دیکھیں۔
روزانہ شام 5 بجے حاضری یاد دہانی کے لیے سیٹنگز میں نوٹیفیکیشن آن کریں۔`,
  },
  {
    page: "/mason",
    titleUr: "مستری شامل کرنا",
    keywords: ["mason", "mistrii", "مستری", "راج میسٹر", "add mason", "نیا مستری", "mistri", "daily wage", "اجرت", "اُجرت", "wage", "مانصاب"],
    content: `نیا مستری بنانے کے لیے "مستری" صفحے پر "+ مستری" بٹن دبائیں۔ نام، موبائل نمبر، سی این آئی سی، والد کا نام، گاؤں اور روزانہ اجرت (daily wage) بھریں۔
مستری بنانے کے بعد اسے پروجیکٹ سے جوڑنے کے لیے متعلقہ پروجیکٹ کے صفحے پر جائیں، "مستری" ٹیب کھولیں اور "مستری شامل کریں" سے اس مستری کو منتخب کریں۔
آپ مستری صفحے پر سرچ باکس سے مستری تلاش کر سکتے ہیں اور سوئچ سے مستری کو فعال/غیر فعال کر سکتے ہیں۔`,
  },
  {
    page: "/mason-attendance",
    titleUr: "مستری کی حاضری لگانا",
    keywords: ["mason attendance", "مستری کی حاضری", "mistrii hazri", "mistri attendance", "مستری حاضری"],
    content: `مستری کی حاضری لگانے کے لیے "مستری کی حاضری" صفحے پر جائیں۔ پروجیکٹ منتخب کریں اور ہر مستری کی حالت منتخب کریں: حاضر، غیر حاضر، یا آدھا دن۔ پھر "محفوظ کریں" دبائیں۔`,
  },
  {
    page: "/mason-payments",
    titleUr: "مستری کی ہفتہ وار تنخواہ",
    keywords: ["mason weekly payment", "مستری تنخواہ", "mistrii weekly", "mason payment", "مستری ادائیگی"],
    content: `مستری کی ہفتہ وار ادائیگی بنانے کے لیے "مستری کی ہفتہ وار تنخواہ" صفحے پر جائیں اور "بنائیں" بٹن دبائیں۔ ایپ خود ہفتے کی حاضری سے ہر مستری کے دن گنتی ہے اور روزانہ اجرت سے حساب لگاتی ہے۔ ادائیگی کی حیثیت تبدیل اور واٹس ایپ پر شیئر کر سکتے ہیں۔`,
  },
  {
    page: "/materials",
    titleUr: "مواد (میٹریل) شامل کرنا",
    keywords: ["material", "materials", "میٹریل", "مواد", "cement", "سیمنٹ", "sand", "ریت", "sariya", "سرخا", "steel", "bricks", "اینٹیں", "quantity", "مقدار", "rate", "ریٹ", "خریدنا", "kharid", "سپلائی"],
    content: `مواد شامل کرنے کے لیے "میٹریل" صفحے پر "+ میٹریل" بٹن دبائیں۔ پروجیکٹ، میٹریل کا نام (مثلاً سیمنٹ، ریت، سرخا)، مقدار (مثلاً 100 بیگز) اور ریٹ (فی بیگ قیمت) بھریں۔
کل رقم خود حساب ہو جاتی ہے۔ مواد کی فہرست پروجیکٹ کے لحاظ سے فلٹر کر سکتے ہیں۔
پروجیکٹ کی تفصیل میں بھی "میٹریل" ٹیب موجود ہے جہاں اس پروجیکٹ کے تمام مواد ایک جگہ نظر آتے ہیں۔`,
  },
  {
    page: "/expenses",
    titleUr: "اخراجات لکھنا",
    keywords: ["expense", "expenses", "خرچ", "اخراجات", "اخراج", "kharcha", "خرچہ", "خچرہ", "category", "زمرہ", "food", "کھانا", "transport", "ٹرانسپورٹ", "fuel", "تیل", "tools", "اوزار", "پیسے", "paisa", "paid"],
    content: `خرچہ لکھنے کے لیے "اخراجات" صفحے پر "+ خرچہ" بٹن دبائیں۔ پروجیکٹ، تاریخ، زمرہ (کھانا، ٹرانسپورٹ، اوزار، تیل وغیرہ)، رقم اور وضاحت بھریں۔
خرچے کی فہرست پروجیکٹ، تاریخ اور زمرے کے مطابق فلٹر کی جا سکتی ہے۔ سب سے اوپر کل رقم نظر آتی ہے۔
کسی خرچے کو ایڈٹ یا ڈیلیٹ کرنے کے لیے اس کے دائیں طرف تین نقطوں والے مینیو پر کلک کریں۔`,
  },
  {
    page: "/equipment",
    titleUr: "مشینری / سامان کرائے پر لینا",
    keywords: ["equipment", "machine", "مشین", "مشینری", "کرایہ", "rent", "کرائے", "جی سی", "jc", "generator", "جنریٹر", "excavator", "ایکسکیویٹر", "دستیاب", "available", "سامان"],
    content: `مشینری کرائے پر لینے کے لیے "ایکوئپمنٹ" صفحے پر "+ ایکوئپمنٹ" بٹن دبائیں۔ پروجیکٹ، تاریخ، مشین کا نام (مثلاً جنریٹر، ایکسکیویٹر)، آپریٹر کا نام، روزانہ کرایہ اور واپسی کی تاریخ بھریں۔
مشین کی موجودگی تبدیل کرنے کے لیے سوئچ استعمال کریں — "دستیاب" یا "رینٹڈ"۔
مشین کا کل خرچہ حساب کرنے کے لیے اس کی تفصیل کھولیں۔`,
  },
  {
    page: "/diary",
    titleUr: "روزانہ ڈائری",
    keywords: ["diary", "daily diary", "ڈائری", "روزانہ", "notes", "نوٹس", "نوٹ", "kayfiyat", "کیفیت", "log", "تحریر"],
    content: `روزانہ ڈائری میں دن بھر کا خلاصہ لکھیں — کیا کام ہوا، کون سی مشکل آئی، اگلے دن کا پلان۔
"ڈائری" صفحے پر نیا نوٹ بنائیں، پروجیکٹ اور تاریخ منتخب کریں اور تحریر کریں۔ پرانے نوٹ تاریخ کے مطابق مل جائیں گے۔
ڈائری پروجیکٹ کے تفصیلی صفحے میں بھی موجود ہے۔`,
  },
  {
    page: "/payments",
    titleUr: "مالک سے ادائیگی / وصولیاں",
    keywords: ["payment", "payments", "ادائیگی", "ادا", "وصولی", "wasooli", "مالک", "owner", "advance", "ایڈوانس", "رقم ملی", "receive", "paid by owner"],
    content: `جب پروجیکٹ کے مالک سے رقم ملے تو "پیمنٹس" صفحے پر "+ ادائیگی" دبائیں۔ پروجیکٹ، تاریخ، رقم اور نوٹ لکھیں۔
ہر پروجیکٹ کی کل وصولی اور بقیہ رقم (کنٹریکٹ مائنس وصولی) پروجیکٹ کی تفصیل میں نظر آتی ہے۔
اگر آپ نے رقم نقد میں دی ہو تو بھی یہیں لکھیں تاکہ حساب پورا رہے۔`,
  },
  {
    page: "/weekly-payment",
    titleUr: "ہفتہ وار مزدور ادائیگی",
    keywords: ["weekly", "weekly payment", "ہفتہ", "ہفتہ وار", "hafta", "ادائیگی", "پیمنٹ", "pay", "تنخواہ", "مزدوری", "generate", "بنائیں"],
    content: `ہفتہ وار ادائیگی بنانے کے لیے "ویکلی پیمنٹ" صفحے پر جائیں اور "ہفتہ وار ادائیگی بنائیں" بٹن دبائیں۔
ایپ خود اِس ہفتے کی حاضری سے ہر مزدور کے دن گنتی ہے اور روزانہ اجرت سے اس کا ہفتے کا حساب لگاتی ہے۔ آپ رقم تبدیل کر سکتے ہیں اور محفوظ کر سکتے ہیں۔
ادا شدہ مزدور کی فہرست "پیمنٹس" صفحے پر مل جائے گی۔`,
  },
  {
    page: "/photos",
    titleUr: "تصاویر / ثبوت",
    keywords: ["photo", "photos", "تصویر", "تصاویر", "picture", "پکچر", "ثبوت", "proof", "evidence", "کیمرہ", "camera"],
    content: `کام کی تصاویر محفوظ کرنے کے لیے "فوٹوز" صفحے پر نیا فوٹو شامل کریں — پروجیکٹ منتخب کریں، تصویر اپ لوڈ کریں اور نوٹ لکھیں۔
یہ تصاویر مالک کو کام دکھانے کے ثبوت کے طور پر کام آتی ہیں۔`,
  },
  {
    page: "/reports",
    titleUr: "رپورٹس",
    keywords: ["report", "reports", "رپورٹ", "رپورٹس", "خلاصہ", "export", "ایکسپورٹ", "download", "ڈاؤن لوڈ", "چھاپنا", "print", "تفصیل"],
    content: `رپورٹس صفحے پر آپ کو پروجیکٹ کی مکمل تفصیل ملتی ہے: کل خرچہ، وصولیاں، بقیہ رقم، مزدوروں کے دن اور ادائیگیاں۔
رپورٹ ڈاؤن لوڈ/پرنٹ کی جا سکتی ہے۔ ڈیش بورڈ پر بھی خلاصہ موجود ہے۔`,
  },
  {
    page: "/settings",
    titleUr: "سیٹنگز (زبان، پاس کوڈ، بیک اپ)",
    keywords: ["settings", "سیٹنگ", "ترتیبات", "language", "زبان", "urdu", "اردو", "english", "انگریزی", "theme", "تھیم", "dark", "ڈارک", "pin", "پن", "پاس کوڈ", "password", "بیک اپ", "backup", "ریسٹور", "restore", "ڈیٹا", "data", "clear"],
    content: `سیٹنگز صفحے میں: زبان تبدیل (اردو/انگریزی)، تھیم (لائٹ/ڈارک)، چار ہندسوں والا پن کوڈ تبدیل، نوٹیفکیشن آن/آف، اور بیک اپ/ریسٹور۔
اپنے تمام ڈیٹا کا بیک اپ لینے کے لیے "ایکسپورٹ" دبائیں — JSON فائل ڈاؤن لوڈ ہو گی۔ واپس لانے کے لیے "ریسٹور" سے وہی فائل منتخب کریں۔
محتاط رہیں: "تمام ڈیٹا صاف کریں" سب کچھ ڈیلیٹ کر دیتا ہے اور پن کوڈ درکار ہوتا ہے۔`,
  },
  {
    page: "/guide",
    titleUr: "یہ گائیڈ",
    keywords: ["guide", "گائیڈ", "مدد", "help", "سکھائیں", "teach", "سوال", "question", "کیسے", "kese", "kesy", "بتائیں", "batao", "کام", "use", "استعمال"],
    content: `یہ گائیڈ آپ کو ایپ استعمال کرنا سکھاتا ہے۔ کوئی بھی سوال اردو یا انگریزی میں پوچھیں — جواب ہمیشہ اردو میں ملے گا۔
ہر جواب میں پہلے براہ راست لنک دیا جاتا ہے، پھر دستی طریقہ۔ لنک پر کلک کریں — ایپ آپ کو سیدھا اسی صفحے پر لے جائے گی۔
مثال سوالات: "نیا پروجیکٹ کیسے بناؤں؟"، "لیبر کو پروجیکٹ میں کیسے شامل کروں؟"، "حاضری کیسے لگائیں؟"`,
  },
  {
    page: "/",
    titleUr: "مارینی وائس اسسٹنٹ",
    keywords: ["voice", "مارینی", "marenii", "وائس", "بول کر", "mic", "مائیک", "آڈیو", "audio", "speak"],
    content: `ایپ میں وائس اسسٹنٹ "مارینی" موجود ہے۔ سکرین کے نیچے مائیک بٹن دبائیں اور اردو یا انگریزی میں بولیں۔
مثال: "نیا پروجیکٹ بنا"، "آج حاضری لگاؤ"، "خرچہ لکھو"۔ مارینی سمجھ کر فوراً کام کر دے گی اور زبانی تصدیق سنائے گی۔ صرف اسی صورت میں سوال کرے گی جب کوئی پروجیکٹ یا مزدور کی پہچان مشکوک ہو — تب نمبر چن کر بتائیں۔
نوٹ: وائس کے لیے انٹرنیٹ اور براؤزر کی مائیک اجازت درکار ہے؛ صوتی تصدیق اردو آواز کے ساتھ چلتی ہے۔`,
  },
  {
    page: "/login",
    titleUr: "لاگ ان اور پہلا استعمال",
    keywords: ["login", "لاگ ان", "pin", "پن", "پہلی بار", "first time", "شروع", "سائن اپ", "setup", "سیٹ اپ", "اکاؤنٹ", "account", "اندازہ"],
    content: `پہلی بار ایپ کھولیں تو آپ کو اکاؤنٹ بنانا ہوگا: اپنا نام، موبائل نمبر اور چار ہندسوں کا پن کوڈ۔ یہ پن کوڈ ہر بار لاگ ان پر درکار ہوگا — اسے محفوظ رکھیں۔
ہر بار ایپ کھولتے وقت پن کوڈ ڈالیں۔ اگر آپ پن بھول جائیں تو سیٹنگز میں پن تبدیل کر سکتے ہیں (صرف پچھلا پن معلوم ہونے پر)۔`,
  },
];

export const GUIDE_LINK_WHITELIST = [
  { pattern: /^\/dashboard$/, label: "ڈیش بورڈ" },
  { pattern: /^\/projects(?:\?action=new)?$/, label: "پروجیکٹس" },
  { pattern: /^\/projects\/\d+$/, label: "پروجیکٹ کی تفصیل" },
  { pattern: /^\/labour(?:\?action=new)?$/, label: "لیبر صفحہ" },
  { pattern: /^\/labour\/\d+$/, label: "مزدور کی تفصیل" },
  { pattern: /^\/mason(?:\?action=new)?$/, label: "مستری صفحہ" },
  { pattern: /^\/mason\/\d+$/, label: "مستری کی تفصیل" },
  { pattern: /^\/attendance(?:\?project_id=\d+)?$/, label: "مزدور کی حاضری" },
  { pattern: /^\/mason-attendance(?:\?project_id=\d+)?$/, label: "مستری کی حاضری" },
  { pattern: /^\/materials(?:\?project_id=\d+|\?action=new)?$/, label: "میٹریل" },
  { pattern: /^\/expenses(?:\?project_id=\d+|\?action=new)?$/, label: "اخراجات" },
  { pattern: /^\/equipment(?:\?project_id=\d+|\?action=new)?$/, label: "ایکوئپمنٹ" },
  { pattern: /^\/diary(?:\?action=new)?$/, label: "ڈائری" },
  { pattern: /^\/payments(?:\?action=new)?$/, label: "پیمنٹس" },
  { pattern: /^\/photos(?:\?action=new)?$/, label: "فوٹوز" },
  { pattern: /^\/weekly-payment$/, label: "مزدور کی ہفتہ وار تنخواہ" },
  { pattern: /^\/mason-payments$/, label: "مستری کی ہفتہ وار تنخواہ" },
  { pattern: /^\/reports$/, label: "رپورٹس" },
  { pattern: /^\/settings$/, label: "سیٹنگز" },
  { pattern: /^\/guide$/, label: "گائیڈ" },
];

export function isAllowedHref(href: string, knownProjectIds: number[]): boolean {
  try {
    if (!href || typeof href !== "string") return false;
    if (!href.startsWith("/")) return false;
    if (/[\\'"<>]/.test(href)) return false;
    const [path, query] = href.split("?");
    const entry = GUIDE_LINK_WHITELIST.find((e) => e.pattern.test(path));
    if (!entry) return false;
    if (query) {
      const qs = new URLSearchParams(query);
      const pid = qs.get("project_id");
      if (pid && !knownProjectIds.includes(Number(pid))) return false;
      const action = qs.get("action");
      if (action && action !== "new") return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function buildGuideSystemPrompt(): string {
  return `تم "ہدایت کار" ہو — Hisab Kitab تعمیراتی اکاؤنٹنگ ایپ کا اردو گائیڈ (ٹیوٹر)۔ تمہارا کام صارف کو ایپ استعمال کرنا سکھانا ہے۔

سخت قواعد:
1. جواب ہمیشہ اردو میں دو، چاہے سوال انگریزی، اردو یا مکس میں ہو۔ اردو الفاظ کے ساتھ جہاں ضروری ہو انگریزی ٹیکنیکل الفاظ استعمال کر سکتے ہو۔
2. جب بھی سوال "کیسے کریں" کے بارے میں ہو: سب سے پہلے "links" میں براہ راست لنک دو، پھر جواب میں آسان دستی اقدامات نمبروں میں لکھو، اور آخر میں صارف کو سمجھاؤ کہ "نیچے دیے گئے لنک پر کلک کریں — ایپ خود آپ کو وہاں لے جائے گی"۔
3. جب سوال کچھ نیا بنانے/شامل کرنے کا ہو تو لنک میں ?action=new شامل کرو تاہم فارم اپنے آپ کھل جائے، مثلاً /projects?action=new، /labour?action=new، /materials?action=new، /expenses?action=new، /equipment?action=new، /diary?action=new، /payments?action=new، /photos?action=new۔
4. links صرف دیے گئے whitelist راستوں اور صارف کے حقیقی پروجیکٹ آئی ڈیز استعمال کرو۔ اگر صارف نے جس پروجیکٹ کا نام لیا وہ پروجیکٹ فہرست میں نہ ہو تو لکھو کہ یہ پروجیکٹ نہیں ملا، اور /projects کا لنک دو۔
5. اپنی مرضی سے کوئی رقم، تعداد، تاریخ یا آئی ڈی کبھی نہ بتاؤ — صرف وہی اعداد استعمال کرو جو صارف کی پروجیکٹ فہرست میں دیے گئے ہیں۔ رقم، تاریخ یا مخصوص ڈیٹا مانگنے پر صاف کہو "یہ معلومات میرے پاس نہیں، آپ خود چیک کریں"۔ کبھی اندازہ نہ لگاؤ۔
6. جواب مختصر اور سادہ رکھو (زیادہ سے زیادہ 8 چھوٹی سطریں)۔ کوئی ایسا کام مت بتاؤ جو ایپ میں موجود نہیں۔ اگر یقین نہ ہو تو تسلیم کرو کہ نہیں جانتے، بجائے من گھڑت جواب کے۔
7. صارف نے جو صفحہ بتایا ہے (کرنٹ پیج) اسی کے مطابق مدد کرو۔
8. صرف درج ذیل JSON فارمیٹ میں جواب دو:
{"answer": "اردو جواب (نئے اقدامات کے لیے \\n استعمال کرو)", "links": [{"label": "بٹن کا متن", "href": "/whitelist/rasta"}]}`;
}

export function buildGuideContext(kbSections: GuideKbSection[], pagePath: string, projects: { id: number; name: string }[]): string {
  const kb = kbSections
    .map((s) => `## ${s.titleUr} (${s.page})\n${s.content}`)
    .join("\n\n---\n\n");
  const projList = projects.length > 0
    ? projects.map((p) => `id:${p.id} — نام: ${p.name}`).join("\n")
    : "ابھی کوئی پروجیکٹ نہیں بنایا گیا";
  return `کرنٹ پیج: ${pagePath}

صارف کے پروجیکٹ (کل ${projects.length}):
${projList}

ایپ کا مکمل علم (ناالج بیس):
${kb}`;
}

export const SUGGESTED_QUESTIONS = [
  "میں نیا پروجیکٹ کیسے بناؤں؟",
  "مزدور کو پروجیکٹ میں کیسے شامل کروں؟",
  "مستری کو پروجیکٹ میں کیسے شامل کروں؟",
  "حاضری کیسے لگائیں؟",
  "میٹریل اور خرچہ کیسے لکھیں؟",
  "ہفتہ وار ادائیگی کیسے بنائیں؟",
  "مالک سے ادائیگی کیسے ریکارڈ کریں؟",
  "مشینری کرایہ پر کیسے لیں؟",
  "پروجیکٹ کا حساب اور رپورٹ کیسے دیکھیں؟",
  "ڈیٹا کا بیک اپ کیسے لوں؟",
  "پن کوڈ کیسے تبدیل کروں؟",
];

export const GUIDE_GREETING = "السلام علیکم! میں ہدایت کار ہوں — آپ کا اپنا گائیڈ۔ بتاؤ کیا مدد کر سکتا ہوں؟ 🎯";

export const ONBOARDING_GREETING =
  "السلام علیکم! میں ہدایت کار ہوں، آپ کا گائیڈ۔ 🎯 ابھی آپ کے پاس کوئی پروجیکٹ نہیں ہے — چلیں پہلا پروجیکٹ بنائیں! پھر اس میں مزدور، مواد اور حاضری سب شامل کریں گے۔";

export const ONBOARDING_QUESTIONS = [
  "پہلا پروجیکٹ کیسے بنائیں؟",
  "پروجیکٹ بنانے کے بعد کیا کروں؟",
  "مزدور کو پروجیکٹ میں کیسے شامل کروں؟",
  "میٹریل اور خرچہ کیسے لکھیں؟",
];

const GREETING_KEYWORDS = ["hello", "hi", "salam", "سلام", "ہیلو", "ہائے", "assalam", "السلام", "hey", "کیسے ہو", "خوش آمدید"];

export function findCannedAnswer(question: string): GuideResponse {
  const clean = question.toLowerCase().trim();
  if (GREETING_KEYWORDS.some((k) => clean.includes(k))) {
    return { answer: GUIDE_GREETING };
  }
  let best: GuideKbSection | null = null;
  let bestScore = 0;
  const kb = getEffectiveKb();
  for (const section of kb) {
    let score = 0;
    for (const kw of section.keywords) {
      if (clean.includes(kw.toLowerCase())) score += kw.length > 5 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = section;
    }
  }
  if (!best) {
    return {
      answer: "معذرت، میں سمجھ نہیں سکا۔ کیا آپ نیا پروجیکٹ بنانا چاہتے ہیں، حاضری لگانا چاہتے ہیں، یا خرچہ لکھنا چاہتے ہیں؟",
      links: [{ label: "گائیڈ کھولیں", href: "/guide" }],
    };
  }
  return {
    answer: best.content.split("\n").slice(0, 3).join("\n"),
    links: [{ label: best.titleUr + " کھولیں", href: best.page }],
  };
}

export interface ProactiveState {
  projectCount: number;
  labourCount: number;
}

/**
 * Returns proactive suggestion chips based on actual app state.
 *
 * - No projects yet → onboarding questions.
 * - Projects exist but no labour → nudge to add labour.
 * - Projects + labour exist → general how-to suggestions.
 * - Otherwise empty (user is fully set up, no urgent nudge).
 */
export function getProactiveSuggestions(state: ProactiveState): string[] {
  if (state.projectCount === 0) {
    return ONBOARDING_QUESTIONS;
  }
  if (state.labourCount === 0) {
    return [
      "مزدور کو پروجیکٹ میں کیسے شامل کروں؟",
      "پہلا مزدور بنائیں",
      "لیبر صفحہ کھولیں",
    ];
  }
  if (state.projectCount > 0 && state.labourCount > 0) {
    return SUGGESTED_QUESTIONS;
  }
  return [];
}
