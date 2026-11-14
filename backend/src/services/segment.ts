/**
 * Audience segmentation for scheduled messages.
 * Age / gender / location are not provided by Meta — they come from the conversation
 * (AI extraction) or staff input, so a filter only matches contacts where the value is known.
 */
import { z } from "zod";
import type { Prisma } from "../lib/prisma.ts";

export const SegmentFiltersSchema = z.object({
  ageMin: z.number().int().min(0).max(120).nullable().optional(),
  ageMax: z.number().int().min(0).max(120).nullable().optional(),
  gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
  cities: z.array(z.string().max(60)).max(30).optional(),
  districts: z.array(z.string().max(60)).max(20).optional(),
  platforms: z.array(z.enum(["FACEBOOK", "INSTAGRAM"])).max(2).optional(),
  activeWithinDays: z.number().int().min(1).max(3650).nullable().optional(),
  hasLead: z.boolean().nullable().optional(),
});

export type SegmentFilters = z.infer<typeof SegmentFiltersSchema>;

export function parseFilters(raw: unknown): SegmentFilters {
  const r = SegmentFiltersSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

/** Contacts targeted by a broadcast: any of its tags (none = everyone) AND every filter. Website visitors are never targeted. */
export function segmentWhere(businessId: string, tagIds: string[], f: SegmentFilters, now = new Date()): Prisma.ContactWhereInput {
  const year = now.getFullYear();
  const and: Prisma.ContactWhereInput[] = [];
  // age = year - birthYear  →  ageMin ≤ age ≤ ageMax
  if (f.ageMin != null) and.push({ birthYear: { lte: year - f.ageMin } });
  if (f.ageMax != null) and.push({ birthYear: { gte: year - f.ageMax } });
  if (f.gender) and.push({ gender: f.gender });
  if (f.cities?.length) and.push({ city: { in: f.cities } });
  if (f.districts?.length) and.push({ district: { in: f.districts } });
  if (f.platforms?.length) and.push({ platform: { in: f.platforms } });
  if (f.activeWithinDays) and.push({ lastInboundAt: { gte: new Date(now.getTime() - f.activeWithinDays * 86_400_000) } });
  if (f.hasLead === true) and.push({ leads: { some: {} } });
  if (f.hasLead === false) and.push({ leads: { none: {} } });

  return {
    businessId,
    NOT: { externalId: { startsWith: "playground:" } },
    platform: { not: "WEB" },
    ...(tagIds.length ? { tags: { some: { tagId: { in: tagIds } } } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}
