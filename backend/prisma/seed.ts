/**
 * Demo data: `npm run db:seed`
 * Login: demo@hariult.ai / demo12345  (restaurant, PRO plan active for 1 month, sample chats & leads)
 * Sample contacts are not linked to a real page, so replying to them from the inbox will fail — connect a page for real chats.
 */
import bcrypt from "bcryptjs";
import { DEFAULT_BOT_SETTINGS } from "../src/businessTypes.ts";
import { prisma } from "../src/lib/prisma.ts";
import { STARTER_TAGS } from "../src/services/account.ts";
import { addMonth } from "../src/services/billing/subscription.ts";

const EMAIL = "demo@hariult.ai";

await prisma.user.deleteMany({ where: { email: EMAIL } });

const now = new Date();
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

const user = await prisma.user.create({
  data: { email: EMAIL, passwordHash: await bcrypt.hash("demo12345", 11), name: "Болд", phone: "99112233" },
});
const business = await prisma.business.create({
  data: {
    ownerId: user.id,
    name: "Хаан Пицца",
    businessType: "restaurant",
    botSettings: { ...DEFAULT_BOT_SETTINGS, botName: "Сараа", greeting: "Сайн байна уу! Хаан Пиццад тавтай морил 🍕" },
    profile: {
      fields: {
        about: "Хаан Пицца — 2018 оноос хойш чулуун зууханд жинхэнэ итали пицца хийж байна.",
        phone: "9911-2233",
        address: "СБД, 1-р хороо, Их тойруу 15 (Улсын их дэлгүүрээс хойш 200м)",
        hours: "Өдөр бүр 10:00–22:00",
        payment: "QPay, карт, бэлэн, данс",
        delivery: "УБ хотын 6 дүүрэгт 40–60 минутад хүргэнэ",
        deliveryFee: "5,000₮ — 50,000₮-с дээш захиалгад үнэгүй",
        reservation: "Ширээг 1 өдрийн өмнө утсаар эсвэл чатаар захиална. 10+ хүнтэй бол урьдчилгаа 30%.",
      },
      items: [
        { name: "Пепперони (30см)", price: "32,000₮", category: "Пицца", description: "Пепперони, моцарелла, томатын соус" },
        { name: "Маргарита (30см)", price: "28,000₮", category: "Пицца", description: "Моцарелла, лаврын навч, томат" },
        { name: "Хаан спешиал (40см)", price: "45,000₮", category: "Пицца", description: "Үхрийн мах, мөөг, чинжүү, сонгино" },
        { name: "Цезарь салат", price: "18,000₮", category: "Салат", description: "Тахианы мах, пармезан, крутон" },
        { name: "Кока кола 1.5л", price: "5,500₮", category: "Ундаа", description: "" },
      ],
      faqs: [
        { q: "Хагас хагас хийж болох уу?", a: "Тийм, 30см болон 40см пиццаг 2 төрлийн амтаар хагаслан хийж болно." },
        { q: "Цагаан хоолтон хүнд юу байна?", a: "Маргарита болон Цезарь салатыг махгүй хийж өгнө." },
      ],
    },
  },
});
await prisma.subscription.create({
  data: { businessId: business.id, plan: "PRO", status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: addMonth(now) },
});
await prisma.payment.create({
  data: { businessId: business.id, plan: "PRO", amount: 199_000, method: "QPAY", status: "PAID", paidAt: now },
});

const tags: Record<string, string> = {};
for (const t of STARTER_TAGS) {
  const tag = await prisma.tag.create({ data: { businessId: business.id, name: t.name, color: t.color } });
  tags[t.name] = tag.id;
  await prisma.tagRule.create({ data: { businessId: business.id, type: "AI_INTENT", tagId: tag.id, intent: t.intent } });
  if (t.keywords.length) await prisma.tagRule.create({ data: { businessId: business.id, type: "KEYWORD", tagId: tag.id, keywords: t.keywords } });
}

type Turn = [dir: "IN" | "OUT", text: string, minutesAgo: number];
const chats: Array<{
  name: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  phone?: string;
  birthYear?: number;
  city?: string;
  district?: string;
  tags: string[];
  needsHuman?: boolean;
  turns: Turn[];
  lead?: { type: "ORDER" | "BOOKING"; details: string };
}> = [
  {
    name: "Номин Батболд",
    platform: "FACEBOOK",
    phone: "88112233",
    birthYear: 1998,
    city: "Улаанбаатар",
    district: "Баянзүрх",
    tags: ["Захиалга", "Үнэ асуусан"],
    turns: [
      ["IN", "Сайн байна уу, пепперони хэд вэ?", 42],
      ["OUT", "Сайн байна уу 😊 Пепперони 30см — 32,000₮. Хүргэлттэй захиалах уу?", 42],
      ["IN", "Тийм 2 ширхэг. БЗД 26-р хороо, 88112233", 40],
      ["OUT", "Баярлалаа! 2 × Пепперони = 64,000₮, хүргэлт үнэгүй 🎉 50 минутын дотор хүргэнэ.", 40],
    ],
    lead: { type: "ORDER", details: "2 × Пепперони (30см), хүргэлт: БЗД 26-р хороо" },
  },
  {
    name: "tuvshin.e",
    platform: "INSTAGRAM",
    birthYear: 1992,
    city: "Улаанбаатар",
    district: "Хан-Уул",
    tags: ["Цаг захиалга"],
    turns: [
      ["IN", "Баасан гарагт 19:00-д 6 хүний ширээ байгаа юу?", 180],
      ["OUT", "Сайн байна уу! Баасан 19:00-д 6 хүний ширээ сул байна 🙌 Нэр, утасны дугаараа үлдээгээрэй.", 179],
      ["IN", "Түвшин, 95001122", 175],
      ["OUT", "Баярлалаа, Түвшин! Баасан 19:00, 6 хүн — ширээ баталгаажлаа ✅", 175],
    ],
    lead: { type: "BOOKING", details: "Баасан 19:00, 6 хүний ширээ" },
  },
  {
    name: "Ганбаатар Д.",
    platform: "FACEBOOK",
    birthYear: 1985,
    city: "Дархан-Уул",
    tags: ["Гомдол"],
    needsHuman: true,
    turns: [
      ["IN", "Өчигдөр захиалсан пицца хүйтэн ирсэн. Менежертэй ярья", 15],
      ["OUT", "Уучлаарай, ийм зүйл тохиолдсонд харамсаж байна 🙏 Таны хүсэлтийг менежерт дамжууллаа, удахгүй холбогдоно.", 15],
    ],
  },
  {
    name: "Сарнай",
    platform: "INSTAGRAM",
    birthYear: 2001,
    city: "Улаанбаатар",
    district: "Сүхбаатар",
    tags: ["Үнэ асуусан"],
    turns: [
      ["IN", "Хаан спешиал ямар орцтой вэ? Бас өнөөдөр хүйтэн байна шүү 🥶", 8],
      ["OUT", "Хаан спешиал 40см — үхрийн мах, мөөг, чинжүү, сонгинотой, 45,000₮ 🍕 Ийм хүйтэнд халуун пицца хамгийн зөв сонголт шүү ❄️ Захиалах уу?", 8],
    ],
  },
];

for (const [i, c] of chats.entries()) {
  const last = c.turns[c.turns.length - 1];
  const lastIn = [...c.turns].reverse().find((t) => t[0] === "IN")!;
  const contact = await prisma.contact.create({
    data: {
      businessId: business.id,
      platform: c.platform,
      externalId: `demo:${i}`,
      name: c.name,
      username: c.platform === "INSTAGRAM" ? c.name : null,
      phone: c.phone,
      birthYear: c.birthYear,
      city: c.city,
      district: c.district,
      needsHuman: !!c.needsHuman,
      lastInboundAt: ago(lastIn[2]),
      lastMessageAt: ago(last[2]),
      lastMessageText: last[1],
      unread: c.needsHuman ? 1 : 0,
      createdAt: ago(c.turns[0][2] + 1),
    },
  });
  for (const [dir, text, m] of c.turns) {
    await prisma.message.create({
      data: { businessId: business.id, contactId: contact.id, direction: dir, sender: dir === "IN" ? "CUSTOMER" : "BOT", text, createdAt: ago(m) },
    });
  }
  for (const t of c.tags) await prisma.contactTag.create({ data: { contactId: contact.id, tagId: tags[t], source: "AI" } });
  if (c.lead) {
    await prisma.lead.create({
      data: { businessId: business.id, contactId: contact.id, type: c.lead.type, name: c.name, phone: c.phone, details: c.lead.details },
    });
  }
}

await prisma.broadcast.create({
  data: {
    businessId: business.id,
    name: "Захиалгын дараах талархал",
    message: "{{first_name}}, Хаан Пиццаг сонгосонд баярлалаа! 🍕 Дараагийн захиалгад 10% хөнгөлөлт: KHAAN10",
    type: "TAG_TRIGGER",
    tagIds: [tags["Захиалга"]],
    delayMinutes: 120,
  },
});
await prisma.broadcast.create({
  data: {
    businessId: business.id,
    name: "Баасан гарагийн урамшуулал",
    message: "Энэ Баасан гарагт 2 дахь пицца 50% 🎉 Захиалах бол энд бичээрэй!",
    type: "RECURRING",
    recurrence: "WEEKLY",
    scheduledAt: new Date(now.getTime() + 2 * 86_400_000),
    nextRunAt: new Date(now.getTime() + 2 * 86_400_000),
  },
});

console.log(`✅ Demo account ready: ${EMAIL} / demo12345`);
await prisma.$disconnect();
process.exit(0);
