/** Canonical Mongolian locations used for segmentation (AI output is normalized to these). */
export const UB = "Улаанбаатар";
export const ABROAD = "Гадаад";

export const AIMAGS = [
  "Архангай", "Баян-Өлгий", "Баянхонгор", "Булган", "Говь-Алтай", "Говьсүмбэр", "Дархан-Уул",
  "Дорноговь", "Дорнод", "Дундговь", "Завхан", "Орхон", "Өвөрхангай", "Өмнөговь", "Сүхбаатар",
  "Сэлэнгэ", "Төв", "Увс", "Ховд", "Хөвсгөл", "Хэнтий",
];

export const CITIES = [UB, ...AIMAGS, ABROAD];

export const UB_DISTRICTS = ["Баянзүрх", "Баянгол", "Сонгинохайрхан", "Сүхбаатар", "Хан-Уул", "Чингэлтэй", "Налайх", "Багануур", "Багахангай"];

/** Common abbreviations / Latin spellings → canonical district */
const DISTRICT_ALIASES: Record<string, string> = {
  бзд: "Баянзүрх", bzd: "Баянзүрх", баянзүрх: "Баянзүрх",
  бгд: "Баянгол", bgd: "Баянгол", баянгол: "Баянгол",
  схд: "Сонгинохайрхан", shd: "Сонгинохайрхан", сонгинохайрхан: "Сонгинохайрхан",
  сбд: "Сүхбаатар", sbd: "Сүхбаатар",
  худ: "Хан-Уул", hud: "Хан-Уул", "хан-уул": "Хан-Уул", хануул: "Хан-Уул",
  чд: "Чингэлтэй", chd: "Чингэлтэй", чингэлтэй: "Чингэлтэй",
  налайх: "Налайх", багануур: "Багануур", багахангай: "Багахангай",
};

export function normalizeDistrict(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (UB_DISTRICTS.includes(v)) return v;
  return DISTRICT_ALIASES[v.toLowerCase().replace(/\s+дүүрэг$/, "").replace(/\s/g, "")] ?? null;
}

export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (["уб", "ub", "улаанбаатар", "ulaanbaatar", "хот"].includes(v)) return UB;
  return CITIES.find((c) => c.toLowerCase() === v || v.startsWith(c.toLowerCase())) ?? null;
}
