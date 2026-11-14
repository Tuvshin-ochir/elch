-- Click-to-Message ads
ALTER TYPE "TagSource" ADD VALUE 'AD';
CREATE TYPE "AdDestination" AS ENUM ('MESSENGER', 'INSTAGRAM_DIRECT');
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'FAILED', 'ARCHIVED');

ALTER TABLE "Contact" ADD COLUMN "adId" TEXT;

CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" "AdDestination" NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "targeting" JSONB NOT NULL,
    "dailyBudget" DOUBLE PRECISION NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "primaryText" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "imageUrl" TEXT,
    "metaCampaignId" TEXT,
    "metaAdSetId" TEXT,
    "metaCreativeId" TEXT,
    "metaAdId" TEXT,
    "metaStatus" TEXT,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "statsUpdatedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdCampaign_metaAdId_key" ON "AdCampaign"("metaAdId");
CREATE INDEX "AdCampaign_businessId_createdAt_idx" ON "AdCampaign"("businessId", "createdAt");
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
