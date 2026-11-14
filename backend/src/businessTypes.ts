/**
 * Dynamic input schemas per business type.
 * The dashboard renders forms from this; the bot turns the answers into knowledge.
 */
type L = { mn: string; en: string };

export interface FieldDef {
  key: string;
  label: L;
  type: "text" | "textarea" | "number";
  placeholder?: L;
}

export interface BusinessTypeDef {
  key: string;
  label: L;
  icon: string;
  fields: FieldDef[];
  items: { label: L; itemLabel: L; columns: FieldDef[] };
  /** Sample rows for the downloadable templates */
  examples: Array<Record<string, string>>;
  sampleFaqs: Array<{ q: string; a: string }>;
}

const f = (key: string, mn: string, en: string, type: FieldDef["type"] = "text", ph?: [string, string]): FieldDef => ({
  key,
  label: { mn, en },
  type,
  ...(ph ? { placeholder: { mn: ph[0], en: ph[1] } } : {}),
});

const COMMON: FieldDef[] = [
  f("about", "Бизнесийн танилцуулга", "About the business", "textarea", ["Бид 2015 оноос хойш...", "Since 2015 we..."]),
  f("phone", "Утас", "Phone", "text", ["9911-2233", "9911-2233"]),
  f("address", "Хаяг / байршил", "Address / location", "textarea"),
  f("hours", "Ажлын цаг", "Opening hours", "text", ["Даваа-Баасан 09:00-18:00", "Mon-Fri 09:00-18:00"]),
  f("payment", "Төлбөрийн хэлбэр", "Payment methods", "text", ["QPay, карт, бэлэн, данс", "QPay, card, cash, transfer"]),
];

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  {
    key: "restaurant",
    label: { mn: "Ресторан / Кафе", en: "Restaurant / Cafe" },
    icon: "🍽️",
    fields: [
      ...COMMON,
      f("delivery", "Хүргэлт (бүс, хугацаа)", "Delivery (areas, time)", "textarea"),
      f("deliveryFee", "Хүргэлтийн төлбөр", "Delivery fee"),
      f("reservation", "Ширээ захиалах журам", "Table reservation policy", "textarea"),
    ],
    items: {
      label: { mn: "Цэс", en: "Menu" },
      itemLabel: { mn: "Хоол", en: "Dish" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("category", "Ангилал", "Category"), f("description", "Тайлбар", "Description")],
    },
    examples: [
      { name: "Пепперони пицца 30см", price: "32,000₮", category: "Пицца", description: "Пепперони, моцарелла бяслаг, томатын соус" },
      { name: "Цезарь салат", price: "18,000₮", category: "Салат", description: "Тахианы мах, пармезан, крутон" },
      { name: "Лимонад 0.5л", price: "6,500₮", category: "Ундаа", description: "Гэрийн нимбэгний лимонад" },
    ],
    sampleFaqs: [
      { q: "Хүргэлт хэдэн цагт ирэх вэ?", a: "УБ хотод 40–60 минутад хүргэнэ." },
      { q: "Ширээ урьдчилж захиалж болох уу?", a: "Болно, утсаар эсвэл чатаар нэр, цаг, хүний тоогоо үлдээгээрэй." },
    ],
  },
  {
    key: "online_shop",
    label: { mn: "Онлайн дэлгүүр", en: "Online shop" },
    icon: "🛍️",
    fields: [
      ...COMMON,
      f("shipping", "Хүргэлтийн нөхцөл", "Shipping terms", "textarea", ["УБ дотор 24 цагт, 5,000₮", "Within UB in 24h, 5,000₮"]),
      f("returns", "Буцаалт, солилтын нөхцөл", "Return & exchange policy", "textarea"),
      f("pickup", "Очиж авах цэг", "Pickup point"),
    ],
    items: {
      label: { mn: "Бүтээгдэхүүн", en: "Products" },
      itemLabel: { mn: "Бараа", en: "Product" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("variants", "Хэмжээ / өнгө", "Size / color"), f("stock", "Үлдэгдэл", "Stock"), f("description", "Тайлбар", "Description")],
    },
    examples: [
      { name: "Эрэгтэй пүүз Air X", price: "189,000₮", variants: "40, 41, 42, 43 / Цагаан, Хар", stock: "12", description: "Хөнгөн, амьсгалдаг материалтай" },
      { name: "Эмэгтэй куртка", price: "245,000₮", variants: "S, M, L / Бежь", stock: "5", description: "Ус нэвтрүүлдэггүй, дулаан доторлогоотой" },
    ],
    sampleFaqs: [
      { q: "Солих, буцаах боломжтой юу?", a: "Шошго нь таслагдаагүй бол 7 хоногийн дотор солино." },
      { q: "Орон нутагт хүргэх үү?", a: "Тийм, унаанд тавьж өгнө. Унааны хөлсийг хүлээн авагч төлнө." },
    ],
  },
  {
    key: "beauty",
    label: { mn: "Гоо сайхан / Салон", en: "Beauty / Salon" },
    icon: "💅",
    fields: [...COMMON, f("booking", "Цаг захиалах арга", "How to book", "textarea"), f("cancel", "Цуцлах журам", "Cancellation policy", "textarea")],
    items: {
      label: { mn: "Үйлчилгээ", en: "Services" },
      itemLabel: { mn: "Үйлчилгээ", en: "Service" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("duration", "Хугацаа", "Duration"), f("staff", "Мастер", "Specialist")],
    },
    examples: [
      { name: "Гель будалт", price: "45,000₮", duration: "1 цаг 30 мин", staff: "Сараа" },
      { name: "Үс тайралт (эмэгтэй)", price: "35,000₮", duration: "45 мин", staff: "Оюука" },
    ],
    sampleFaqs: [
      { q: "Цагаа хэрхэн цуцлах вэ?", a: "Цагаасаа 3 цагийн өмнө чатаар эсвэл утсаар мэдэгдээрэй." },
      { q: "Урьдчилгаа төлөх үү?", a: "Амралтын өдрүүдэд 10,000₮ урьдчилгаа авна." },
    ],
  },
  {
    key: "clinic",
    label: { mn: "Эмнэлэг / Шүд", en: "Clinic / Dental" },
    icon: "🩺",
    fields: [...COMMON, f("booking", "Цаг авах журам", "Appointment process", "textarea"), f("insurance", "Даатгал", "Insurance"), f("emergency", "Яаралтай тусламж", "Emergency info", "textarea")],
    items: {
      label: { mn: "Үйлчилгээ / эмч", en: "Services / doctors" },
      itemLabel: { mn: "Үйлчилгээ", en: "Service" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("doctor", "Эмч", "Doctor"), f("schedule", "Хуваарь", "Schedule")],
    },
    examples: [
      { name: "Шүд цэвэрлэгээ", price: "60,000₮", doctor: "Др. Батболд", schedule: "Да–Ба 09:00–17:00" },
      { name: "Шүдний ломбо", price: "80,000₮-с", doctor: "Др. Сарантуяа", schedule: "Да–Бя 10:00–18:00" },
    ],
    sampleFaqs: [
      { q: "Даатгал хамрагдах уу?", a: "Эрүүл мэндийн даатгалын гэрээт байгууллага тул зарим үйлчилгээ хамрагдана." },
      { q: "Хүүхэд үзэх үү?", a: "Тийм, 3-аас дээш насны хүүхдийг үзнэ." },
    ],
  },
  {
    key: "education",
    label: { mn: "Сургалт / Курс", en: "Education / Courses" },
    icon: "🎓",
    fields: [...COMMON, f("enroll", "Бүртгүүлэх журам", "Enrollment process", "textarea"), f("format", "Хэлбэр (танхим / онлайн)", "Format (in-person / online)"), f("certificate", "Сертификат", "Certificate")],
    items: {
      label: { mn: "Хөтөлбөр", en: "Courses" },
      itemLabel: { mn: "Курс", en: "Course" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("duration", "Үргэлжлэх хугацаа", "Duration"), f("start", "Эхлэх огноо", "Start date"), f("level", "Түвшин", "Level")],
    },
    examples: [
      { name: "Англи хэл — эхлэн суралцагч", price: "350,000₮", duration: "3 сар", start: "12-р сарын 1", level: "Анхан" },
      { name: "Python програмчлал", price: "550,000₮", duration: "2 сар", start: "12-р сарын 10", level: "Дунд" },
    ],
    sampleFaqs: [
      { q: "Онлайнаар суралцаж болох уу?", a: "Тийм, бүх хичээл Zoom-ээр давхар явагдана." },
      { q: "Сертификат олгох уу?", a: "Төгсөлтийн шалгалт өгсөн хүнд сертификат олгоно." },
    ],
  },
  {
    key: "real_estate",
    label: { mn: "Үл хөдлөх хөрөнгө", en: "Real estate" },
    icon: "🏠",
    fields: [...COMMON, f("financing", "Зээл / санхүүжилт", "Mortgage / financing", "textarea"), f("viewing", "Үзлэг товлох", "Viewing appointments", "textarea")],
    items: {
      label: { mn: "Зарууд", en: "Listings" },
      itemLabel: { mn: "Байр", en: "Listing" },
      columns: [f("name", "Гарчиг", "Title"), f("price", "Үнэ", "Price"), f("location", "Байршил", "Location"), f("rooms", "Өрөө", "Rooms"), f("area", "Талбай м²", "Area m²")],
    },
    examples: [
      { name: "2 өрөө байр, Зайсан", price: "320 сая₮", location: "ХУД, 11-р хороо", rooms: "2", area: "64" },
      { name: "3 өрөө байр, Яармаг", price: "410 сая₮", location: "ХУД, 4-р хороо", rooms: "3", area: "92" },
    ],
    sampleFaqs: [
      { q: "Ипотекийн зээлд хамрагдах уу?", a: "Тийм, 6%-ийн ипотект хамрагдана." },
      { q: "Үзлэгт яаж очих вэ?", a: "Нэр, утас, тохиромжтой цагаа үлдээвэл агент холбогдоно." },
    ],
  },
  {
    key: "hotel_tour",
    label: { mn: "Зочид буудал / Аялал", en: "Hotel / Travel" },
    icon: "🏨",
    fields: [...COMMON, f("checkin", "Check-in / out цаг", "Check-in / out time"), f("amenities", "Үйлчилгээ, тохижилт", "Amenities", "textarea"), f("cancel", "Цуцлах нөхцөл", "Cancellation policy", "textarea")],
    items: {
      label: { mn: "Өрөө / аялал", en: "Rooms / tours" },
      itemLabel: { mn: "Өрөө", en: "Room" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("capacity", "Багтаамж / хугацаа", "Capacity / length"), f("includes", "Багтсан зүйлс", "Includes")],
    },
    examples: [
      { name: "Стандарт өрөө (2 хүн)", price: "180,000₮ / шөнө", capacity: "2 хүн", includes: "Өглөөний цай, Wi-Fi" },
      { name: "Тэрэлж 2 өдрийн аялал", price: "290,000₮ / хүн", capacity: "2 өдөр 1 шөнө", includes: "Унаа, хоол, гэр буудал" },
    ],
    sampleFaqs: [
      { q: "Хэдэн цагт check-in хийх вэ?", a: "Check-in 14:00, check-out 12:00." },
      { q: "Цуцлах нөхцөл?", a: "3 хоногийн өмнө цуцалбал төлбөрийг бүрэн буцаана." },
    ],
  },
  {
    key: "auto",
    label: { mn: "Авто засвар / Сэлбэг", en: "Auto service / Parts" },
    icon: "🚗",
    fields: [...COMMON, f("warranty", "Баталгаа", "Warranty", "textarea"), f("booking", "Цаг захиалга", "Booking", "textarea")],
    items: {
      label: { mn: "Үйлчилгээ / сэлбэг", en: "Services / parts" },
      itemLabel: { mn: "Үйлчилгээ", en: "Service" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("model", "Машины загвар", "Car model"), f("duration", "Хугацаа", "Duration")],
    },
    examples: [
      { name: "Тос солих", price: "85,000₮-с", model: "Prius 20/30/41", duration: "30 мин" },
      { name: "Тоормосны наклад", price: "120,000₮", model: "Бүх суудлын", duration: "1 цаг" },
    ],
    sampleFaqs: [
      { q: "Баталгаа өгөх үү?", a: "Сэлбэг болон ажилд 3 сарын баталгаа өгнө." },
      { q: "Урьдчилан цаг авах уу?", a: "Тийм, чатаар машины загвар, хүссэн цагаа үлдээгээрэй." },
    ],
  },
  {
    key: "fitness",
    label: { mn: "Фитнес / Спорт", en: "Fitness / Sports" },
    icon: "🏋️",
    fields: [...COMMON, f("trainers", "Дасгалжуулагчид", "Trainers", "textarea"), f("trial", "Туршилтын хичээл", "Trial session")],
    items: {
      label: { mn: "Гишүүнчлэл", en: "Memberships" },
      itemLabel: { mn: "Багц", en: "Package" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("duration", "Хугацаа", "Duration"), f("includes", "Багтсан", "Includes")],
    },
    examples: [
      { name: "1 сарын эрх", price: "120,000₮", duration: "30 хоног", includes: "Фитнес, хувцас солих өрөө" },
      { name: "Хувийн дасгалжуулагч 8 удаа", price: "320,000₮", duration: "1 сар", includes: "Хоолны зөвлөгөө" },
    ],
    sampleFaqs: [
      { q: "Туршилтын хичээл байгаа юу?", a: "1 удаагийн эрх 15,000₮." },
      { q: "Хэдэн цагт ажилладаг вэ?", a: "Өдөр бүр 07:00–22:00." },
    ],
  },
  {
    key: "other",
    label: { mn: "Бусад үйлчилгээ", en: "Other" },
    icon: "✨",
    fields: [...COMMON, f("extra", "Нэмэлт мэдээлэл", "Additional info", "textarea")],
    items: {
      label: { mn: "Бүтээгдэхүүн / үйлчилгээ", en: "Products / services" },
      itemLabel: { mn: "Зүйл", en: "Item" },
      columns: [f("name", "Нэр", "Name"), f("price", "Үнэ", "Price"), f("description", "Тайлбар", "Description")],
    },
    examples: [
      { name: "Үндсэн үйлчилгээ", price: "50,000₮", description: "Үйлчилгээний товч тайлбар" },
      { name: "Нэмэлт үйлчилгээ", price: "20,000₮", description: "Нэмэлт тайлбар" },
    ],
    sampleFaqs: [
      { q: "Хаана байрладаг вэ?", a: "Манай хаяг: ..." },
      { q: "Ямар төлбөрийн хэлбэр авдаг вэ?", a: "QPay, карт, бэлэн." },
    ],
  },
];

export function getBusinessType(key: string): BusinessTypeDef {
  return BUSINESS_TYPES.find((t) => t.key === key) ?? BUSINESS_TYPES[BUSINESS_TYPES.length - 1];
}

export interface BusinessProfile {
  fields?: Record<string, string>;
  items?: Array<Record<string, string>>;
  faqs?: Array<{ q: string; a: string }>;
}

export interface BotSettings {
  enabled?: boolean;
  botName?: string;
  tone?: "friendly" | "formal" | "playful";
  useEmoji?: boolean;
  greeting?: string;
  handoffMessage?: string;
  customInstructions?: string;
  collectLeads?: boolean;
  /** Politely ask location (district / aimag) when it fits — used for audience segmentation */
  askProfile?: boolean;
}

export const DEFAULT_BOT_SETTINGS: Required<BotSettings> = {
  enabled: true,
  botName: "",
  tone: "friendly",
  useEmoji: true,
  greeting: "",
  handoffMessage: "Таны хүсэлтийг ажилтанд дамжууллаа, удахгүй холбогдох болно 🙏",
  customInstructions: "",
  collectLeads: true,
  askProfile: false,
};

export interface WidgetSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  welcome: string;
  color: string;
  position: "right" | "left";
}

export const DEFAULT_WIDGET: WidgetSettings = {
  enabled: true,
  title: "",
  subtitle: "Ихэвчлэн хэдхэн секундэд хариулдаг",
  welcome: "Сайн байна уу! 👋 Танд юугаар туслах вэ?",
  color: "#12805a",
  position: "right",
};

export function widgetSettingsOf(raw: unknown): WidgetSettings {
  return { ...DEFAULT_WIDGET, ...((raw ?? {}) as Partial<WidgetSettings>) };
}

/** Render the dynamic form answers as plain text knowledge for the bot. */
export function profileToText(type: BusinessTypeDef, profile: BusinessProfile): string {
  const lines: string[] = [];
  for (const field of type.fields) {
    const v = profile.fields?.[field.key]?.trim();
    if (v) lines.push(`${field.label.mn}: ${v}`);
  }
  const items = (profile.items ?? []).filter((it) => Object.values(it).some((v) => v?.trim()));
  if (items.length) {
    lines.push("", `## ${type.items.label.mn}`);
    for (const it of items) {
      const parts = type.items.columns
        .map((c) => (it[c.key]?.trim() ? `${c.label.mn}: ${it[c.key].trim()}` : null))
        .filter(Boolean);
      lines.push(`- ${parts.join(" | ")}`);
    }
  }
  const faqs = (profile.faqs ?? []).filter((x) => x.q?.trim() && x.a?.trim());
  if (faqs.length) {
    lines.push("", "## Түгээмэл асуулт, хариулт");
    for (const x of faqs) lines.push(`Асуулт: ${x.q.trim()}\nХариулт: ${x.a.trim()}`);
  }
  return lines.join("\n");
}
