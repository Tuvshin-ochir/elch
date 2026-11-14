/**
 * Privacy policy, terms of service and data-deletion instructions (Mongolian + English).
 * Meta requires the privacy policy and data deletion URLs before the Facebook / Instagram apps can be published.
 * Review with the business owner / a lawyer before relying on it.
 */
import { BRAND } from "./brand";

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{ h: string; p?: string[]; list?: string[] }>;
}

const UPDATED_MN = "Сүүлд шинэчилсэн: 2026 оны 11-р сарын 14";
const UPDATED_EN = "Last updated: November 14, 2026";

const contactMn = `Имэйл: ${BRAND.supportEmail} · Утас: ${BRAND.supportPhone}`;
const contactEn = `Email: ${BRAND.supportEmail} · Phone: ${BRAND.supportPhone}`;

export const PRIVACY: Record<"mn" | "en", LegalDoc> = {
  mn: {
    title: "Нууцлалын бодлого",
    updated: UPDATED_MN,
    intro: `${BRAND.name} ("бид") нь бизнесүүдэд Facebook Messenger, Instagram болон вэбсайтаар ирсэн мессежид AI-аар хариулах үйлчилгээ үзүүлдэг. Энэхүү бодлого нь бид ямар мэдээлэл цуглуулж, яаж ашиглаж, хамгаалж, устгадгийг тайлбарлана.`,
    sections: [
      {
        h: "1. Бидний цуглуулдаг мэдээлэл",
        list: [
          "Бизнес эрхлэгчийн бүртгэл: нэр, имэйл, утас, нууц үгийн hash. Facebook эсвэл Instagram-аар нэвтэрвэл тухайн платформын хэрэглэгчийн ID, нэр, профайл зураг.",
          "Бизнесийн мэдээлэл: таны оруулсан бараа, үйлчилгээ, үнэ, түгээмэл асуулт, файл, ботын тохиргоо.",
          "Meta-аас авах мэдээлэл (таны зөвшөөрлөөр): холбосон Facebook пэйж, Instagram аккаунтын нэр, ID, зураг, нийтлэл, пэйжийн танилцуулга; пэйж/аккаунт руу ирсэн мессеж, коммент; бичсэн хүний Meta-аас өгсөн нэр, хэрэглэгчийн нэр, профайл зураг; access token (шифрлэгдсэн).",
          "Вэбсайтын чат: зочны бичсэн мессеж, өөрөө өгсөн нэр, утас.",
          "Ярианаас гаргасан мэдээлэл: хэрэглэгч чатад дурдсан нас, хүйс, хот, дүүрэг (сегментчлэлд).",
          "Төлбөр: банкнаас өгсөн картын token болон сүүлийн 4 орон, QPay нэхэмжлэлийн мэдээлэл. Бид картын бүтэн дугаар хадгалдаггүй.",
          "Техникийн мэдээлэл: аюулгүй байдлын зорилгоор IP хаяг, хөтчийн мэдээлэл бүхий лог.",
        ],
      },
      {
        h: "2. Мэдээллийг ашиглах зорилго",
        list: [
          "Таны хэрэглэгчдийн мессежид таны бизнесийн мэдээллээр автоматаар хариулах.",
          "Нэгдсэн inbox, захиалга/лид бүртгэл, tag, Meta-ийн 24 цагийн дүрмийн хүрээнд товлосон мессеж илгээх.",
          "Аналитик, төлбөр тооцоо, хэрэглэгчийн дэмжлэг, аюулгүй байдал.",
        ],
        p: ["Meta-аас авсан мэдээллийг зөвхөн тухайн пэйж/аккаунтыг холбосон бизнест үйлчилгээ үзүүлэхэд ашиглана. Бид мэдээллийг зардаггүй, зар сурталчилгаанд ашигладаггүй."],
      },
      {
        h: "3. AI боловсруулалт",
        p: [
          "Хариу үүсгэхийн тулд мессеж болон таны бизнесийн холбогдох мэдээллийг Anthropic компанийн Claude API руу илгээдэг. Anthropic нь бидний өмнөөс мэдээлэл боловсруулагч бөгөөд арилжааны нөхцөлийнхөө дагуу API-ийн өгөгдлөөр загвараа сургадаггүй.",
        ],
      },
      {
        h: "4. Мэдээлэл хуваалцах",
        list: [
          "Үйлчилгээ үзүүлэгчид: Railway (сервер, мэдээллийн сан — АНУ), Anthropic (AI), Meta (мессеж илгээх), QPay болон банкууд (төлбөр).",
          "Хуулийн дагуу шаардсан тохиолдолд эрх бүхий байгууллагад.",
        ],
      },
      {
        h: "5. Хадгалалт ба хамгаалалт",
        p: [
          "Бүх холболт HTTPS-ээр шифрлэгдэнэ. Meta-ийн access token-уудыг AES-256-GCM-ээр шифрлэж хадгална. Мэдээлэлд зөвхөн шаардлагатай ажилтан хандана.",
          "Мэдээллийг таны бүртгэл идэвхтэй байх хугацаанд хадгална. Пэйж/аккаунтаа салгах эсвэл Meta-аар дамжуулан устгах хүсэлт илгээхэд холбогдох token, пэйжийн мэдээллийг шууд устгана. Бүртгэлээ бүрэн устгуулах хүсэлтийг 30 хоногийн дотор биелүүлнэ.",
        ],
      },
      {
        h: "6. Таны эрх, мэдээлэл устгах",
        p: [
          "Та өөрийн мэдээллийг харах, засах, устгуулах эрхтэй. Facebook эсвэл Instagram-ын тохиргооноос манай аппыг хасахад бид тухайн платформоос авсан мэдээллийг автоматаар устгана. Дэлгэрэнгүйг /data-deletion хуудаснаас үзнэ үү, эсвэл бидэнтэй холбогдоно уу.",
        ],
      },
      { h: "7. Хүүхэд", p: ["Үйлчилгээ нь бизнес эрхлэгчдэд зориулагдсан бөгөөд 18 наснаас доош хүнд зориулагдаагүй."] },
      { h: "8. Өөрчлөлт", p: ["Бодлогыг шинэчилбэл энэ хуудсанд огноотой нь нийтэлж, чухал өөрчлөлтийг имэйлээр мэдэгдэнэ."] },
      { h: "9. Холбоо барих", p: [contactMn] },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: UPDATED_EN,
    intro: `${BRAND.nameEn} ("we") helps businesses answer messages from Facebook Messenger, Instagram and their website with AI. This policy explains what we collect, how we use and protect it, and how it is deleted.`,
    sections: [
      {
        h: "1. Information we collect",
        list: [
          "Business owner account: name, email, phone, password hash. If you sign in with Facebook or Instagram: that platform's user ID, name and profile picture.",
          "Business information you provide: products, services, prices, FAQs, files and bot settings.",
          "Information from Meta (with your permission): name, ID, picture, posts and page info of the Facebook Page / Instagram account you connect; messages and comments sent to it; the sender's name, username and profile picture as provided by Meta; access tokens (encrypted).",
          "Website chat: messages and any name or phone number a visitor chooses to share.",
          "Details mentioned in conversations: age, gender, city or district a customer mentions (used for segmentation).",
          "Payments: card token and last 4 digits provided by the bank, QPay invoice details. We never store full card numbers.",
          "Technical data: logs with IP address and browser information, for security.",
        ],
      },
      {
        h: "2. How we use information",
        list: [
          "To reply automatically to your customers' messages using your business information.",
          "To provide the unified inbox, order/lead capture, tagging, and scheduled messages within Meta's 24-hour messaging policy.",
          "For analytics, billing, customer support and security.",
        ],
        p: ["Data received from Meta is used only to provide the service to the business that connected that Page or account. We do not sell data or use it for advertising."],
      },
      {
        h: "3. AI processing",
        p: [
          "To generate replies, messages and the relevant business information are sent to Anthropic's Claude API. Anthropic processes this data on our behalf and, under its commercial terms, does not train its models on API data.",
        ],
      },
      {
        h: "4. Sharing",
        list: [
          "Service providers: Railway (hosting and database, USA), Anthropic (AI), Meta (sending messages), QPay and banks (payments).",
          "Authorities, when required by law.",
        ],
      },
      {
        h: "5. Storage and security",
        p: [
          "All connections use HTTPS. Meta access tokens are encrypted with AES-256-GCM. Access is limited to staff who need it.",
          "We keep data while your account is active. When you disconnect a Page/account or send a deletion request through Meta, the related tokens and page data are deleted immediately. Full account deletion requests are completed within 30 days.",
        ],
      },
      {
        h: "6. Your rights and data deletion",
        p: [
          "You can access, correct or delete your data. When you remove our app in your Facebook or Instagram settings, we automatically delete the data obtained from that platform. See /data-deletion or contact us.",
        ],
      },
      { h: "7. Children", p: ["The service is for businesses and is not intended for anyone under 18."] },
      { h: "8. Changes", p: ["We will post updates on this page with a new date and notify you by email of material changes."] },
      { h: "9. Contact", p: [contactEn] },
    ],
  },
};

export const TERMS: Record<"mn" | "en", LegalDoc> = {
  mn: {
    title: "Үйлчилгээний нөхцөл",
    updated: UPDATED_MN,
    intro: `${BRAND.name}-ийн үйлчилгээнд бүртгүүлж ашигласнаар та энэхүү нөхцөлийг зөвшөөрч байна.`,
    sections: [
      { h: "1. Үйлчилгээ", p: ["Facebook Messenger, Instagram болон вэбсайтын чатад AI-аар хариулах, inbox, захиалга бүртгэл, tag, товлосон мессеж, аналитик зэрэг програм хангамжийн үйлчилгээ."] },
      { h: "2. Бүртгэл", p: ["Та үнэн зөв мэдээлэл өгч, нэвтрэх мэдээллээ нууцлах үүрэгтэй. Холбосон пэйж, аккаунтдаа эрх бүхий байх ёстой."] },
      {
        h: "3. Зөвшөөрөгдөх хэрэглээ",
        list: [
          "Meta-ийн Platform Terms болон Messenger, Instagram-ын бодлого, мессеж илгээх 24 цагийн дүрмийг мөрдөнө.",
          "Спам, хууль бус, төөрөгдүүлэх агуулга илгээхийг хориглоно.",
          "Ботод оруулсан мэдээллийн (үнэ, нөхцөл) үнэн зөвийг та хариуцна.",
        ],
      },
      { h: "4. AI-ийн хариу", p: ["AI хариу ихэнхдээ зөв боловч алдаа гаргаж болно. Чухал шийдвэрийг ажилтан баталгаажуулахыг зөвлөж байна; бот шаардлагатай үед ярианыг ажилтанд шилжүүлнэ."] },
      { h: "5. Төлбөр", p: ["Үйлчилгээ сар бүр урьдчилан төлөгдөнө, гэрээний хугацаагүй. Хүссэн үедээ зогсоож болох ба төлсөн хугацаа дуустал үйлчилгээ үргэлжилнэ. Багцын хязгаар хэтэрвэл тухайн сард бот хариулахаа зогсооно."] },
      { h: "6. Түр хаах, цуцлах", p: ["Нөхцөл зөрчсөн тохиолдолд бид бүртгэлийг түр хааж эсвэл цуцалж болно. Та хүссэн үедээ бүртгэлээ устгуулах хүсэлт гаргаж болно."] },
      { h: "7. Хариуцлагын хязгаар", p: ["Үйлчилгээг \"байгаа байдлаар\" нь үзүүлнэ. Хуулиар зөвшөөрөгдсөн хэмжээнд бидний хариуцлага сүүлийн 1 сард таны төлсөн дүнгээс хэтрэхгүй."] },
      { h: "8. Хууль", p: ["Энэхүү нөхцөлд Монгол Улсын хууль үйлчилнэ."] },
      { h: "9. Холбоо барих", p: [contactMn] },
    ],
  },
  en: {
    title: "Terms of Service",
    updated: UPDATED_EN,
    intro: `By signing up for and using ${BRAND.nameEn}, you agree to these terms.`,
    sections: [
      { h: "1. Service", p: ["Software that answers Facebook Messenger, Instagram and website chat messages with AI, plus inbox, order capture, tagging, scheduled messages and analytics."] },
      { h: "2. Account", p: ["Provide accurate information and keep your login secure. You must be authorized to manage the Pages and accounts you connect."] },
      {
        h: "3. Acceptable use",
        list: [
          "Follow Meta's Platform Terms, Messenger and Instagram policies, including the 24-hour messaging window.",
          "No spam, unlawful or misleading content.",
          "You are responsible for the accuracy of the information (prices, terms) you give the bot.",
        ],
      },
      { h: "4. AI replies", p: ["AI replies are usually accurate but can be wrong. Have staff confirm important decisions; the bot hands conversations to a person when needed."] },
      { h: "5. Payment", p: ["Billed monthly in advance with no long-term contract. You can stop at any time; service continues until the paid period ends. If a plan limit is exceeded, the bot stops replying for that month."] },
      { h: "6. Suspension and termination", p: ["We may suspend or terminate accounts that violate these terms. You may request deletion of your account at any time."] },
      { h: "7. Limitation of liability", p: ["The service is provided \"as is\". To the extent permitted by law, our liability is limited to the amount you paid in the last month."] },
      { h: "8. Governing law", p: ["These terms are governed by the laws of Mongolia."] },
      { h: "9. Contact", p: [contactEn] },
    ],
  },
};

export const DATA_DELETION: Record<"mn" | "en", LegalDoc & { statusTitle: string; statusDone: string; statusPending: string; notFound: string; codeLabel: string }> = {
  mn: {
    title: "Мэдээлэл устгах",
    updated: UPDATED_MN,
    intro: "Facebook эсвэл Instagram-аар дамжуулан бидэнд өгсөн мэдээллээ хэрхэн устгуулах заавар.",
    sections: [
      {
        h: "Facebook-ээр",
        list: [
          "Facebook → Settings & privacy → Settings → Apps and websites хэсэгт орно.",
          `${BRAND.nameEn}-ийг сонгоод Remove дарна. "Delete…" сонголтыг тэмдэглэвэл устгах хүсэлт бидэнд автоматаар ирнэ.`,
        ],
      },
      {
        h: "Instagram-аар",
        list: ["Instagram → Settings → Website permissions → Apps and websites хэсэгт орно.", `${BRAND.nameEn}-ийг сонгоод Remove дарна.`],
      },
      {
        h: "Юу устах вэ",
        p: [
          "Тухайн платформоос авсан access token, холбосон пэйж/аккаунт, пэйжээс татсан мэдээлэл, профайлын холбоос шууд устна. Хүсэлтийн баталгаажуулах кодоор доор төлөвөө шалгана уу.",
          `Бүртгэлээ бүхэлд нь устгуулах бол бидэнд бичнэ үү — 30 хоногийн дотор устгана. ${contactMn}`,
        ],
      },
    ],
    statusTitle: "Хүсэлтийн төлөв",
    statusDone: "Устгагдсан",
    statusPending: "Хүлээгдэж буй",
    notFound: "Ийм кодтой хүсэлт олдсонгүй.",
    codeLabel: "Баталгаажуулах код",
  },
  en: {
    title: "Data Deletion",
    updated: UPDATED_EN,
    intro: "How to delete the data you shared with us through Facebook or Instagram.",
    sections: [
      {
        h: "Through Facebook",
        list: ["Go to Facebook → Settings & privacy → Settings → Apps and websites.", `Select ${BRAND.nameEn} and click Remove. Tick the "Delete…" option to send us a deletion request automatically.`],
      },
      {
        h: "Through Instagram",
        list: ["Go to Instagram → Settings → Website permissions → Apps and websites.", `Select ${BRAND.nameEn} and click Remove.`],
      },
      {
        h: "What is deleted",
        p: [
          "Access tokens, connected Pages/accounts, data imported from them and the profile link are deleted immediately. Use your confirmation code below to check the status.",
          `To delete your whole account, contact us — we complete it within 30 days. ${contactEn}`,
        ],
      },
    ],
    statusTitle: "Request status",
    statusDone: "Deleted",
    statusPending: "Pending",
    notFound: "No request found with this code.",
    codeLabel: "Confirmation code",
  },
};
