export type PlanCode = "STARTER" | "BUSINESS" | "PRO";
export type Platform = "FACEBOOK" | "INSTAGRAM" | "WEB";
export type L = { mn: string; en: string };

export interface PlanDef {
  code: PlanCode;
  price: number;
  name: L;
  limits: { pages: number; aiReplies: number; knowledgeFiles: number; broadcastsPerMonth: number | null };
  features: { aiTagging: boolean; commentAutoReply: boolean; sequences: boolean; imageUnderstanding: boolean; leadCapture: boolean };
}

export interface Usage {
  used: number;
  limit: number | null;
}

export interface SubscriptionSummary {
  plan: PlanCode;
  planDef: PlanDef;
  pendingPlan: PlanCode | null;
  status: "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELED";
  active: boolean;
  accessEndsAt: string | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  failedAttempts: number;
  nextRetryAt: string | null;
  defaultCard: { id: string; brand: string; last4: string; expMonth: number; expYear: number } | null;
  usage: { aiReplies: Usage; pages: Usage; knowledgeFiles: Usage; broadcasts: Usage };
}

export interface Me {
  user: {
    id: string;
    email: string | null;
    name: string;
    phone: string | null;
    locale: string;
    avatarUrl: string | null;
    fbUserId: string | null;
    igUserId: string | null;
  };
  business: { id: string; name: string; businessType: string };
  subscription: SubscriptionSummary;
}

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
}

export interface BotSettings {
  enabled: boolean;
  botName: string;
  tone: "friendly" | "formal" | "playful";
  useEmoji: boolean;
  greeting: string;
  handoffMessage: string;
  customInstructions: string;
  collectLeads: boolean;
  askProfile: boolean;
}

export interface Business {
  id: string;
  name: string;
  businessType: string;
  typeDef: BusinessTypeDef;
  profile: { fields: Record<string, string>; items: Array<Record<string, string>>; faqs: Array<{ q: string; a: string }> };
  botSettings: BotSettings;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  contactCount?: number;
  source?: "MANUAL" | "KEYWORD" | "AI" | "COMMENT";
}

export interface Contact {
  id: string;
  platform: Platform;
  externalId: string;
  name: string | null;
  username: string | null;
  profilePic: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  birthYear: number | null;
  gender: "MALE" | "FEMALE" | null;
  city: string | null;
  district: string | null;
  lastInboundAt: string | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  unread: number;
  botPausedUntil: string | null;
  needsHuman: boolean;
  createdAt: string;
  tags: Tag[];
  page: { id: string; name: string; igUsername: string | null } | null;
}

export interface Message {
  id: string;
  contactId: string;
  direction: "IN" | "OUT";
  sender: "CUSTOMER" | "BOT" | "AGENT" | "BROADCAST" | "SYSTEM";
  text: string;
  attachments: { images?: string[] } | null;
  error: string | null;
  createdAt: string;
}

export interface Lead {
  id: string;
  type: "ORDER" | "BOOKING" | "INQUIRY";
  name: string | null;
  phone: string | null;
  details: string;
  status: "NEW" | "CONTACTED" | "DONE" | "CANCELED";
  createdAt: string;
  contact?: { id: string; name: string | null; platform: string; profilePic: string | null; phone: string | null };
}

export interface KnowledgeSource {
  id: string;
  type: "FILE" | "PAGE_SYNC" | "URL" | "TEXT" | "FAQ";
  title: string;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  url: string | null;
  status: "PROCESSING" | "READY" | "FAILED";
  error: string | null;
  createdAt: string;
  chars: number;
  preview: string;
}

export interface ConnectedPage {
  id: string;
  kind: "FACEBOOK_LOGIN" | "INSTAGRAM_LOGIN" | "INSTAGRAM_UNIFIED";
  fbPageId: string | null;
  tokenExpiresAt: string | null;
  fbEnabled: boolean;
  igEnabled: boolean;
  name: string;
  pictureUrl: string | null;
  category: string | null;
  igAccountId: string | null;
  igUsername: string | null;
  commentAutoReply: boolean;
  commentReplyText: string | null;
  commentDmText: string | null;
  lastSyncedAt: string | null;
}

export interface TagRule {
  id: string;
  type: "KEYWORD" | "AI_INTENT" | "COMMENT";
  tagId: string;
  tag: Tag;
  keywords: string[];
  intent: string | null;
  postId: string | null;
  active: boolean;
}

export interface Broadcast {
  id: string;
  name: string;
  message: string;
  type: "ONE_TIME" | "RECURRING" | "TAG_TRIGGER" | "INACTIVITY";
  tagIds: string[];
  filters: SegmentFilters;
  scheduledAt: string | null;
  recurrence: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  delayMinutes: number | null;
  messageTag: string | null;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "DONE";
  nextRunAt: string | null;
  lastRunAt: string | null;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
}

export interface SegmentFilters {
  ageMin?: number | null;
  ageMax?: number | null;
  gender?: "MALE" | "FEMALE" | null;
  cities?: string[];
  districts?: string[];
  platforms?: Array<"FACEBOOK" | "INSTAGRAM">;
  activeWithinDays?: number | null;
  hasLead?: boolean | null;
}
