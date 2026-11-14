/**
 * Click-to-Message ads through the Meta Marketing API.
 * Flow: campaign (OUTCOME_ENGAGEMENT) → ad set (optimization CONVERSATIONS, destination
 * MESSENGER / INSTAGRAM_DIRECT, targeting) → creative (MESSAGE_PAGE call to action) → ad.
 * Everything is created PAUSED first and only activated when every step succeeded.
 * Requires the ads_management permission on the owner's Facebook login and an ad account.
 */
import { UB } from "../../locations.ts";
import { graph } from "./graph.ts";

export const ADS_SCOPES = ["ads_management", "ads_read"];

/** Meta sends budgets in the currency's minor unit; these currencies have none. */
const ZERO_DECIMAL = new Set(["CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND"]);
export const toMinor = (amount: number, currency: string) => Math.round(amount * (ZERO_DECIMAL.has(currency) ? 1 : 100));
export const fromMinor = (amount: number, currency: string) => amount / (ZERO_DECIMAL.has(currency) ? 1 : 100);

/** Mongolian aimag / city names → Meta location search terms */
const GEO_SEARCH: Record<string, string> = {
  [UB]: "Ulaanbaatar", Архангай: "Arkhangai", "Баян-Өлгий": "Bayan-Olgii", Баянхонгор: "Bayankhongor", Булган: "Bulgan",
  "Говь-Алтай": "Govi-Altai", Говьсүмбэр: "Govisumber", "Дархан-Уул": "Darkhan-Uul", Дорноговь: "Dornogovi", Дорнод: "Dornod",
  Дундговь: "Dundgovi", Завхан: "Zavkhan", Орхон: "Orkhon", Өвөрхангай: "Ovorkhangai", Өмнөговь: "Omnogovi",
  Сүхбаатар: "Sukhbaatar", Сэлэнгэ: "Selenge", Төв: "Tov", Увс: "Uvs", Ховд: "Khovd", Хөвсгөл: "Khovsgol", Хэнтий: "Khentii",
};

/** Approximate centres of Ulaanbaatar districts (targeted as a radius around the point). */
export const UB_DISTRICT_CENTERS: Record<string, [number, number]> = {
  Баянзүрх: [47.9155, 106.9705],
  Баянгол: [47.9058, 106.8655],
  Сонгинохайрхан: [47.9295, 106.7985],
  Сүхбаатар: [47.9300, 106.9200],
  "Хан-Уул": [47.8790, 106.9020],
  Чингэлтэй: [47.9370, 106.9050],
  Налайх: [47.7740, 107.2560],
  Багануур: [47.7820, 108.3680],
  Багахангай: [47.3230, 107.4730],
};

export interface AdTargetingInput {
  ageMin: number;
  ageMax: number;
  gender: "MALE" | "FEMALE" | null;
  cities: string[];
  districts: string[];
  radiusKm: number;
}

export async function hasAdsPermission(userToken: string): Promise<boolean> {
  const r = await graph<{ data: Array<{ permission: string; status: string }> }>("me/permissions", { token: userToken }).catch(() => ({ data: [] }));
  return r.data.some((p) => p.permission === "ads_management" && p.status === "granted");
}

export interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name?: string;
}

export async function listAdAccounts(userToken: string): Promise<AdAccount[]> {
  const r = await graph<{ data: AdAccount[] }>("me/adaccounts", {
    token: userToken,
    query: { fields: "id,name,account_status,currency,timezone_name", limit: "100" },
  });
  return r.data;
}

type GeoLocations = {
  countries?: string[];
  regions?: Array<{ key: string }>;
  cities?: Array<{ key: string; radius?: number; distance_unit?: string }>;
  custom_locations?: Array<{ latitude: number; longitude: number; radius: number; distance_unit: "kilometer" }>;
};

/** Turn our location picks into Meta geo_locations (searching Meta's location keys by name). */
export async function resolveGeo(userToken: string, t: AdTargetingInput): Promise<GeoLocations> {
  const districts = t.districts.filter((d) => UB_DISTRICT_CENTERS[d]);
  const cities = t.cities.filter((c) => GEO_SEARCH[c] && !(c === UB && districts.length));
  if (!cities.length && !districts.length) return { countries: ["MN"] };

  const geo: GeoLocations = {};
  const missing: string[] = [];
  for (const c of cities) {
    const r = await graph<{ data: Array<{ key: string; type: string; country_code: string }> }>("search", {
      token: userToken,
      query: { type: "adgeolocation", q: GEO_SEARCH[c], country_code: "MN", location_types: JSON.stringify(["region", "city"]) },
    });
    const hit = r.data.find((x) => x.country_code === "MN");
    if (!hit) missing.push(c);
    else if (hit.type === "region") (geo.regions ??= []).push({ key: hit.key });
    else (geo.cities ??= []).push({ key: hit.key, radius: 25, distance_unit: "kilometer" });
  }
  if (missing.length) throw new Error(`Meta дээр байршил олдсонгүй: ${missing.join(", ")}`);
  if (districts.length) {
    geo.custom_locations = districts.map((d) => ({
      latitude: UB_DISTRICT_CENTERS[d][0],
      longitude: UB_DISTRICT_CENTERS[d][1],
      radius: Math.max(1, Math.min(80, t.radiusKm)),
      distance_unit: "kilometer" as const,
    }));
  }
  return geo;
}

export function buildTargeting(t: AdTargetingInput, geo: GeoLocations, destination: "MESSENGER" | "INSTAGRAM_DIRECT") {
  return {
    geo_locations: geo,
    age_min: Math.max(18, Math.min(65, t.ageMin)),
    age_max: Math.max(18, Math.min(65, t.ageMax)),
    ...(t.gender ? { genders: [t.gender === "MALE" ? 1 : 2] } : {}),
    // Respect the owner's exact age / location choice
    targeting_automation: { advantage_audience: 0 },
    ...(destination === "INSTAGRAM_DIRECT" ? { publisher_platforms: ["instagram"] } : {}),
  };
}

export async function estimateAudience(userToken: string, adAccountId: string, targeting: object) {
  const r = await graph<{ data: Array<{ estimate_mau_lower_bound?: number; estimate_mau_upper_bound?: number; estimate_ready?: boolean }> }>(
    `${adAccountId}/delivery_estimate`,
    { token: userToken, query: { targeting_spec: JSON.stringify(targeting), optimization_goal: "CONVERSATIONS" } },
  );
  const d = r.data[0] ?? {};
  return { lower: d.estimate_mau_lower_bound ?? null, upper: d.estimate_mau_upper_bound ?? null };
}

export async function uploadImage(userToken: string, adAccountId: string, image: Buffer) {
  const r = await graph<{ images: Record<string, { hash: string; url: string }> }>(`${adAccountId}/adimages`, {
    method: "POST",
    token: userToken,
    body: { bytes: image.toString("base64") },
  });
  const first = Object.values(r.images)[0];
  if (!first) throw new Error("Image upload failed");
  return first;
}

export interface CreateAdInput {
  userToken: string;
  adAccountId: string;
  currency: string;
  name: string;
  pageId: string;
  igAccountId: string | null;
  destination: "MESSENGER" | "INSTAGRAM_DIRECT";
  targeting: object;
  dailyBudget: number;
  startAt: Date;
  endAt: Date | null;
  primaryText: string;
  headline: string;
  imageHash: string;
  activate: boolean;
}

/** Creates campaign → ad set → creative → ad. Rolls the campaign back if a later step fails. */
export async function createClickToMessageAd(i: CreateAdInput) {
  const token = i.userToken;
  const campaign = await graph<{ id: string }>(`${i.adAccountId}/campaigns`, {
    method: "POST",
    token,
    body: {
      name: i.name,
      objective: "OUTCOME_ENGAGEMENT",
      status: "PAUSED",
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    },
  });
  try {
    const adset = await graph<{ id: string }>(`${i.adAccountId}/adsets`, {
      method: "POST",
      token,
      body: {
        name: `${i.name} — audience`,
        campaign_id: campaign.id,
        daily_budget: toMinor(i.dailyBudget, i.currency),
        billing_event: "IMPRESSIONS",
        optimization_goal: "CONVERSATIONS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        destination_type: i.destination,
        promoted_object: { page_id: i.pageId },
        targeting: i.targeting,
        start_time: i.startAt.toISOString(),
        ...(i.endAt ? { end_time: i.endAt.toISOString() } : {}),
        status: "PAUSED",
      },
    });
    const creative = await graph<{ id: string }>(`${i.adAccountId}/adcreatives`, {
      method: "POST",
      token,
      body: {
        name: `${i.name} — creative`,
        object_story_spec: {
          page_id: i.pageId,
          ...(i.destination === "INSTAGRAM_DIRECT" && i.igAccountId ? { instagram_user_id: i.igAccountId } : {}),
          link_data: {
            message: i.primaryText,
            name: i.headline,
            image_hash: i.imageHash,
            link: "https://fb.com/messenger_doc/",
            call_to_action: { type: "MESSAGE_PAGE", value: { app_destination: i.destination } },
          },
        },
      },
    });
    const ad = await graph<{ id: string }>(`${i.adAccountId}/ads`, {
      method: "POST",
      token,
      body: { name: i.name, adset_id: adset.id, creative: { creative_id: creative.id }, status: "PAUSED" },
    });
    if (i.activate) await setStatus(token, [campaign.id, adset.id, ad.id], "ACTIVE");
    return { campaignId: campaign.id, adSetId: adset.id, creativeId: creative.id, adId: ad.id };
  } catch (err) {
    await graph(campaign.id, { method: "DELETE", token }).catch(() => undefined);
    throw err;
  }
}

export async function setStatus(userToken: string, ids: string[], status: "ACTIVE" | "PAUSED") {
  for (const id of ids) await graph(id, { method: "POST", token: userToken, body: { status } });
}

export async function deleteCampaign(userToken: string, campaignId: string) {
  await graph(campaignId, { method: "DELETE", token: userToken }).catch(() => undefined);
}

/** Lifetime insights + delivery status of the ad. */
export async function fetchAdStats(userToken: string, campaignId: string, adId: string) {
  const [ins, ad] = await Promise.all([
    graph<{ data: Array<{ impressions?: string; reach?: string; clicks?: string; spend?: string; actions?: Array<{ action_type: string; value: string }> }> }>(
      `${campaignId}/insights`,
      { token: userToken, query: { fields: "impressions,reach,clicks,spend,actions", date_preset: "maximum" } },
    ),
    graph<{ effective_status?: string }>(adId, { token: userToken, query: { fields: "effective_status" } }),
  ]);
  const d = ins.data[0] ?? {};
  const conv = d.actions?.find((a) => a.action_type.startsWith("onsite_conversion.messaging_conversation_started"))?.value;
  return {
    stats: {
      impressions: Number(d.impressions ?? 0),
      reach: Number(d.reach ?? 0),
      clicks: Number(d.clicks ?? 0),
      spend: Number(d.spend ?? 0),
      conversations: Number(conv ?? 0),
    },
    effectiveStatus: ad.effective_status ?? null,
  };
}
