# Элч (Elch) — Facebook & Instagram AI чатбот (SaaS)

Монгол бизнесүүдэд зориулсан, **Facebook Messenger, Instagram Direct болон өөрийн вэбсайт** дээр 24/7 хүн шиг хариулдаг AI чатбот платформ.
Олон хуудастай маркетинг сайт, сарын subscription (99,000₮ / 149,000₮ / 199,000₮ — үнэгүй туршилтгүй), QPay болон банкны картаар төлөх, картаас автомат сунгалттай.

| Хэсэг | Технологи |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS 4, MN/EN хэл |
| Backend | Express 5 + Prisma 7 + PostgreSQL 17 |
| AI | Claude (Anthropic) — `claude-opus-5-5`, structured output |
| Төлбөр | QPay merchant v2 (mock горимтой), картын adapter (одоохондоо sandbox банк) |

---

## Боломжууд

**Бүртгэл / нэвтрэлт** — имэйлээр, эсвэл **Facebook-ээр / Instagram-аар** бүртгүүлэх ба нэвтрэх.
Facebook-ээр бүртгүүлбэл пэйжийн эрх нэг дор авагдана, Instagram-аар бүртгүүлбэл тэр IG аккаунт автоматаар суваг болж холбогдоно.
Үнэгүй туршилт байхгүй: бүртгүүлсний дараа шууд төлбөрийн хуудас руу орно, төлбөр төлөгдөх хүртэл бот хариулахгүй.

**Суваг сонгох** — бизнес эзэн аль сувгаа автоматжуулахаа өөрөө сонгоно:
- **Facebook Messenger** — Facebook Login-оор пэйжээ холбоно (пэйжтэй холбоотой Instagram-ыг хамт сонгож болно).
- **Instagram Direct** — Instagram Login-оор **Facebook пэйжгүйгээр** IG Professional аккаунтаа шууд холбоно.
- **Вэбсайт чат** — `<script src="{PUBLIC_API_URL}/widget.js" data-key="…" async></script>` нэг мөр кодоор чат цонх нэмнэ (өнгө, гарчиг, мэндчилгээ, байрлал тохируулна; `/widget-demo?key=…` дээр туршина).
- Холболт бүр дээр Messenger / Instagram автоматжуулалтыг тусад нь асааж унтраана.

**Чатбот**
- Пэйжид ирсэн мессежид бизнесийн мэдээллээр хариулна. Үнэ, бараа, нөхцөлийн талаар зохиож хариулахгүй.
- Сэдвээс гадуур асуултад жинхэнэ хүн шиг товч, найрсаг хариулаад яриаг бизнес рүү буцааж чиглүүлнэ.
- Монгол хэлийг латинаар бичсэн ч ("une hed ve") ойлгоно.
- Хэрэглэгчийн илгээсэн зургийг ойлгоно (Бизнес, Про багц).
- Захиалга, цаг авалт, утасны дугаарыг өөрөө асууж бүртгэнэ (**Захиалга / Лид**).
- Хүн рүү шилжүүлэх: хэрэглэгч хүн хүсвэл эсвэл гомдол гаргавал бот 12 цаг зогсоод "Хүн хүлээж буй" гэж тэмдэглэнэ.
- Хэрэглэгч дараалан хэд хэдэн мессеж бичихэд 2.5 секунд хүлээж байгаад бүгдэд нь нэг дор хариулна.

**Мэдлэгийн сан** (бот юу мэдэх вэ)
1. **Пэйжээс автоматаар татна**: пэйжийн танилцуулга, хаяг, цаг, утас, FB постууд, IG bio болон пост тайлбарууд.
2. **Бизнест тохирсон dynamic форм**: ресторан бол цэс, дэлгүүр бол бараа/размер/үлдэгдэл, салон бол үйлчилгээ/мастер гэх мэт 10 төрөл. CSV-ээс импортлох боломжтой.
3. **Бүх төрлийн файл**: PDF, Word, Excel/CSV, PowerPoint, зураг, TXT. Скан хийсэн PDF болон зургийг Claude уншина.
4. **Вэбсайтын холбоос**, чөлөөт текст, асуулт-хариулт (FAQ).

**Tag-лах 4 арга**: гараар · түлхүүр үгээр · AI ангиллаар (intent) · пост дээр коммент бичсэнээр.

**Товлосон мессеж — 4 горим**: нэг удаа · давтамжтай (өдөр/7 хоног/сар) · tag нэмэгдсэнээс N минутын дараа · хэрэглэгч идэвхгүй болсноос N минутын дараа.
Meta-ийн 24 цагийн дүрмийг мөрдөнө. 24 цагаас хойш зөвхөн message tag-тай (`CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE`) мессеж илгээнэ.

**Хэрэглэгчийг ангилж илгээх** (Товлосон мессеж → Нарийвчилсан шүүлтүүр): tag + нас, хүйс, хот/аймаг, УБ-ын дүүрэг, суваг, сүүлд бичсэн хугацаа, захиалга өгсөн эсэх.
Meta нь хэрэглэгчийн нас, байршлыг API-аар **өгдөггүй** тул эдгээрийг (1) хэрэглэгч чатад дурдахад AI автоматаар таньж хадгална, (2) ажилтан Inbox-оос гараар оруулна, (3) «байршил асуух» тохиргоо асаалттай бол бот эелдгээр асууна.

**Шинэ хэрэглэгч татах — Click-to-Message зар** (Dashboard → Шинэ хэрэглэгч): танай руу бичиж байгаагүй хүмүүст шууд мессеж илгээхийг Meta хориглодог (spam) тул нас, хүйс, хот/аймаг, УБ-ын дүүрэг (радиус)-ээр таргетлэсэн «Мессеж илгээх» зарыг Meta Marketing API-аар үүсгэнэ. Дарсан хүн чат эхлүүлэхэд бот хариулж, тэр хүнийг «Зараас» tag-лана; зар бүрийн харсан/дарсан/зарцуулсан/чат/лид-ийг харуулна. Зарын төлбөрийг Meta-д өөрийн зарын аккаунтаар төлнө.

**Аналитик** (Dashboard → Аналитик): өмнөх үетэй харьцуулсан KPI, мессежийн урсгал, суваг тус бүр, гараг × цагийн heatmap, AI хариулах хурд, борлуулалтын funnel, лид/tag задаргаа, түгээмэл үгс, broadcast үр дүн, CSV экспорт.

**Загвар файлууд** (Мэдлэгийн сан): бизнесийн төрөл тус бүрд жишээ өгөгдөлтэй Excel/CSV/TXT загвар татаж, бөглөөд буцааж оруулахад форм автоматаар бөглөгдөнө.

**Бусад**: нэгдсэн Inbox (SSE-ээр шууд шинэчлэгдэнэ, ботыг зогсоох/асаах), коммент автомат хариулт + DM, тест чат (playground), статистик, Meta Business Suite-ээс хүн хариулахад ботыг автоматаар зогсоох.

**Багц ба төлбөр**
| | Старт 99,000₮ | Бизнес 149,000₮ | Про 199,000₮ |
|---|---|---|---|
| Холболт (FB пэйж ба/эсвэл IG) | 1 | 2 | 5 |
| AI хариулт / сар | 2,000 | 6,000 | 15,000 |
| Файл | 20 | 100 | 500 |
| Broadcast / сар | 4 | 20 | ∞ |
| AI tag, коммент хариулт, зураг ойлгох | – | ✓ | ✓ |
| Tag болон идэвхгүй үеийн автомат мессеж | – | – | ✓ |

- Үнэгүй туршилт байхгүй — бот зөвхөн төлбөртэй (ACTIVE) багц дээр ажиллана (тест чат ч мөн адил).
- QPay QR болон банкны апп-ын deeplink. Callback ирэхэд QPay-ээс дахин шалгаж баталгаажуулна, 1 минут тутам polling хийнэ.
- Карт холбох нь банкны hosted хуудсаар дамжиж token хэлбэрээр хадгалагдана. Картын дугаар манай DB-д хадгалагдахгүй.
- **Автомат сунгалт**: асаасан бол хугацаа дуусахаас 1 цагийн өмнө картаас татна. Амжилтгүй бол 24 цаг тутам 3 удаа дахин оролдоно, энэ хугацаанд бот 3 хоногийн grace-тэй ажиллана. Үүний дараа EXPIRED болно.
- Ижил багцыг дахин төлвөл хугацаа дээр нь нэмэгдэнэ. Өөр багц руу шилжвэл төлсөн өдрөөс шинэ хугацаа эхэлнэ.

---

## Хурдан эхлэх

Шаардлага: Node 22+, Docker.

```bash
# 1) Тохиргоо
cp backend/.env.example backend/.env       # ANTHROPIC_API_KEY, JWT_SECRET, ENCRYPTION_KEY-г бөглөнө
cp frontend/.env.example frontend/.env.local

# 2) Postgres + dependency + migration + demo өгөгдөл
npm install
npm run setup

# 3) Хоёр серверийг зэрэг асаах
npm run dev
```

- Сайт: http://localhost:3100 — API: http://localhost:4100
- Демо нэвтрэлт: **demo@hariult.ai / demo12345** (ресторан, Про багц, жишээ чат болон лидтэй)
- `ENCRYPTION_KEY` нь 64 тэмдэгттэй hex байна: `openssl rand -hex 32`

> Postgres-ийн порт **5440** (docker-compose.yml). Порт солих бол `DATABASE_URL`-ийг хамт өөрчилнө.

### Claude API
- `ANTHROPIC_API_KEY`-г `backend/.env`-д хийнэ. Anthropic аккаунтад кредит байх шаардлагатай.
- Үндсэн модель нь `AI_MODEL=claude-opus-5-5`, `AI_EFFORT=low` (чатад хангалттай, хурдан). Зардал багасгах бол `AI_MODEL=claude-sonnet-5-5` эсвэл `claude-haiku-5-5` болгож болно.
- Opus 5.5 / Sonnet 5.5 дээр safety refusal-ийн үед `fallbacks: "default"` server-side fallback идэвхтэй байна.
- Тест чат (Бот тохиргоо → Тест чат) ашиглавал пэйж холбохгүйгээр ботыг шууд турших боломжтой.

---

## Meta (Facebook + Instagram) холбох

Нэг Meta app-аар хоёр замыг хоёуланг нь дэмжинэ:

| | Facebook Login (пэйж + холбоотой IG) | Instagram Login (зөвхөн IG) |
|---|---|---|
| Хэнд | Facebook пэйжтэй бизнес | Зөвхөн Instagram-тай бизнес |
| .env | `META_APP_ID`, `META_APP_SECRET` | `IG_APP_ID`, `IG_APP_SECRET` |
| Redirect | `{PUBLIC_API_URL}/api/oauth/facebook/callback` | `{PUBLIC_API_URL}/api/oauth/instagram/callback` (**https** заавал) |
| Webhook | Webhooks → **Page** + **Instagram** object | Instagram product → **Configure webhooks** |

1. [developers.facebook.com](https://developers.facebook.com) → **Create App** → Use case **Other** → Type **Business**.
2. **App settings → Basic** → App ID / App secret → `META_APP_ID`, `META_APP_SECRET`.
3. **Facebook Login for Business** → Valid OAuth Redirect URIs: `{PUBLIC_API_URL}/api/oauth/facebook/callback` (бүртгүүлэх/нэвтрэх болон пэйж холбох — нэг URL).
4. **Messenger** product нэмнэ.
5. **Instagram** product → *API setup with Instagram login* → Instagram app ID / secret → `IG_APP_ID`, `IG_APP_SECRET`. *Set up Instagram business login* → redirect URL: `{PUBLIC_API_URL}/api/oauth/instagram/callback`.
6. Local дээр `PUBLIC_API_URL`-ийг https tunnel болгоно: `cloudflared tunnel --url http://localhost:4100`.
7. Webhook (бүгдэд нь ижил): Callback `{PUBLIC_API_URL}/webhooks/meta`, Verify token `META_VERIFY_TOKEN`.
   - Webhooks → **Page**: `messages`, `messaging_postbacks`, `message_echoes`, `messaging_referrals`, `feed`
   - Webhooks → **Instagram**: `messages`, `comments`
   - Instagram product → Configure webhooks (Instagram Login): `messages`, `comments`
8. Нэвтрэх/бүртгүүлэх хуудасны "Facebook-ээр / Instagram-аар" товч, эсвэл Dashboard → **Сувгууд** → "Facebook-ээр холбох" / "Instagram-аар холбох".
   Facebook Login-д `email`, `public_profile` эрх мөн хэрэгтэй (бүртгүүлэхэд). App-аа Live болгохдоо **Data Deletion URL** болон Privacy Policy URL заавал оруулна.
9. Development горимд зөвхөн апп дээр role-той (admin/developer/tester) хүмүүсийн мессеж ирнэ. Instagram Login-оор турших бол App roles → **Instagram testers**-д IG аккаунтаа нэмээд IG апп → Settings → Apps and websites → Tester invites хэсгээс зөвшөөрнө.
10. **Зар үүсгэгч**-д нэмэлт эрх: `ads_management`, `ads_read` (Шинэ хэрэглэгч хуудасны «Зарын эрх олгох» товч энэ эрхийг хүснэ), мөн business.facebook.com дээр **зарын аккаунт + төлбөрийн хэрэгсэл**. Login for Business-ийн configuration ашиглаж байгаа бол эдгээр эрхийг configuration-д нэмнэ.
11. Production-д гарахын өмнө App Review хийлгэнэ:
    - Facebook: `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_read_user_content`, `pages_manage_engagement`, `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `business_management`
    - Instagram Login: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`

Холбогдмогц пэйж / IG профайлын мэдээлэл болон постууд мэдлэгийн сан руу автоматаар татагдана. Instagram Login-ийн token 60 хоног хүчинтэй бөгөөд scheduler өөрөө сунгана.

## Админ (/admin)

Платформ эзэмшигчийн удирдлага — бизнес эрхлэгчдийн бүртгэлээс тусдаа (`Admin` хүснэгт, тусдаа токен).

```bash
npm --prefix backend run admin:create -- you@example.com "Нэр"   # шинэ админ, эсвэл нууц үг сэргээх
```

Нууц үгийг `ADMIN_PASSWORD` env-ээр өгөхгүй бол санамсаргүй үүсгээд нэг удаа хэвлэнэ. Нэвтрэх: `http://localhost:3100/admin`.

- **Тойм** — MRR, сарын орлого, төлбөртэй харилцагч, бүртгэл → төлбөрийн хувь, 30 хоногийн орлого/мессеж/бүртгэл, 7 хоногт дуусах захиалгууд, системийн тохиргооны төлөв
- **Харилцагчид** — хайлт (нэр, имэйл, утас, пэйж, @IG), төлөв/багцаар шүүх, AI хэрэглээ, нийт төлсөн дүн
- **Бизнесийн дэлгэрэнгүй** — дансаар/бэлнээр авсан төлбөр бүртгэх (багц идэвхжинэ), үнэгүй хоног сунгах, багц/төлөв/огноо засах, дотоод тэмдэглэл, **түр хаах** (бот зогсож, нэвтрэх эрх болон картын автомат таталт хаагдана)
- **Төлбөрүүд** — бүх гүйлгээ, арга тус бүрийн нийлбэр

## Брэнд, icon

Лого = «Э» үсгийг чат бөмбөлөг хэлбэрээр. Бүх icon (favicon, apple, PWA, Facebook-д хуваалцах зураг) нэг скриптээс үүснэ:

```bash
cd frontend && node scripts/generate-icons.mjs
```

## Deploy (Railway)

`main` салбар руу push хийхэд Railway автоматаар deploy хийнэ. Нэг project дотор 3 service ажиллана:

| Service | Root | Build | Start | Тайлбар |
|---|---|---|---|---|
| `Postgres` | — | — | — | Railway Postgres |
| `api` | `/backend` | `npm run build` (prisma generate) | `npm start` | deploy бүрийн өмнө `npx prisma migrate deploy`, healthcheck `/health` |
| `web` | `/frontend` | `npm run build` | `npm start` | `NEXT_PUBLIC_*` build үед уншигдана |

Гол хувьсагчид: `api` → `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `NODE_ENV=production`, `PUBLIC_API_URL`, `APP_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `TZ=Asia/Ulaanbaatar`; `web` → `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`.

Production-д mock төлбөр унтраалттай (`ALLOW_MOCK_PAYMENTS=false`): хэрэглэгч дансаар шилжүүлж, та `/admin`-аас идэвхжүүлнэ. Дансны мэдээллээ `MANUAL_PAYMENT_NOTE`-д бичнэ. Production мэдээллийн санд **seed ажиллуулахгүй**.

## QPay
`QPAY_CLIENT_ID` хоосон бол **mock горим** ажиллана: QR код үүсгэгдэж, "Төлсөн гэж дуурайлгах" товч гарч ирнэ.
Жинхэнэ болгох бол `QPAY_BASE_URL` (sandbox: `https://merchant-sandbox.qpay.mn`, prod: `https://merchant.qpay.mn`), `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`-г бөглөнө. Callback нь `{PUBLIC_API_URL}/api/billing/qpay/callback`.

## Банкны карт (автомат таталт)
Одоохондоо `CARD_PROVIDER=mock` буюу туршилтын банк ажиллаж байна (`/mock-bank/checkout`):
- `4242 4242 4242 4242`: амжилттай
- `4000 0000 0000 0002`: карт холбогдоно, гэхдээ төлбөр бүр татгалзана (автомат төлөлт амжилтгүй болох урсгалыг турших)

Жинхэнэ банк (Golomt, Khan, TDB…) холбох бол `backend/src/services/billing/cardProviders/types.ts` доторх `CardProvider` interface-ийг хэрэгжүүлнэ:
- `createSetupSession` → банкны hosted карт оруулах хуудасны URL
- `charge(token, amount, idempotencyKey)` → token-оор татах

Дараа нь adapter-аа `cardProviders/index.ts`-д бүртгээд `CARD_PROVIDER`-ийг сольж, банкны callback-аас ирсэн token-оор `PaymentMethod` үүсгэх route нэмнэ (`routes/mockBank.ts`-ийг жишээ болгон ашиглана).
**Production-д `CARD_PROVIDER=mock` ашиглаж болохгүй.**

---

## Бүтэц

```
backend/
  prisma/schema.prisma          # өгөгдлийн загвар
  prisma/seed.ts                # демо өгөгдөл
  src/plans.ts                  # багцын үнэ, лимит, боломж (эх сурвалж)
  src/businessTypes.ts          # бизнесийн төрөл тус бүрийн dynamic форм
  src/services/ai/              # Claude: prompt, structured reply, файл унших
  src/services/chat/            # мессеж хүлээн авах → AI → илгээх
  src/services/meta/            # Graph API, webhook боловсруулалт
  src/services/knowledge/       # файл задлах, пэйж sync, retrieval
  src/services/billing/         # QPay, картын adapter, subscription
  src/services/scheduler.ts     # broadcast + автомат сунгалт (cron)
  src/routes/                   # REST API (auth, oauth, widget, templates, analytics, …)
  src/widget/widget.js          # вэбсайтад суулгах чат widget (vanilla JS, shadow DOM)
frontend/
  src/app/(marketing)/          # нүүр, /solutions, /industries, /features, /pricing, /faq
  src/components/marketing/     # маркетинг хуудсуудын компонентууд
  src/components/charts.tsx     # аналитикийн графикууд (SVG)
  src/app/dashboard/            # хяналтын самбар (inbox, мэдлэг, бот, tag, broadcast, төлбөр…)
  src/app/mock-bank/            # туршилтын банкны хуудас
  src/lib/i18n/                 # MN / EN орчуулга
  src/lib/plans.ts              # landing-д харуулах багц (backend/src/plans.ts-тэй ижил байлгана)
```

Брэндийн нэр, холбоо барих мэдээллийг `frontend/src/lib/brand.ts` дотор өөрчилнө.

## Аюулгүй байдлын тэмдэглэл
- Meta access token-ууд AES-256-GCM-ээр шифрлэгдэж хадгалагдана.
- Webhook-ийн `X-Hub-Signature-256`-г шалгана. Production-д `META_APP_SECRET` заавал байх ёстой.
- QPay callback-д шууд итгэхгүй, QPay API-аас дахин шалгана.
- Вэбсайтаас мэдээлэл татахдаа дотоод сүлжээний хаягийг хориглоно (SSRF хамгаалалт).
- Нэвтрэх болон бүртгүүлэх endpoint-д rate limit тавьсан.
