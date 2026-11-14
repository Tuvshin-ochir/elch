-- Website chat widget channel

-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'WEB';

-- Business: public widget key (backfilled for existing rows) + widget settings
ALTER TABLE "Business" ADD COLUMN "widgetKey" TEXT;
UPDATE "Business" SET "widgetKey" = 'w' || substr(md5(random()::text || "id"), 1, 24) WHERE "widgetKey" IS NULL;
ALTER TABLE "Business" ALTER COLUMN "widgetKey" SET NOT NULL;
ALTER TABLE "Business" ADD COLUMN "widgetSettings" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "Business_widgetKey_key" ON "Business"("widgetKey");
