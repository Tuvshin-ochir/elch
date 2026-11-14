-- Audience segmentation for scheduled messages (age, gender, location, …)
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

ALTER TABLE "Contact" ADD COLUMN "birthYear" INTEGER;
ALTER TABLE "Contact" ADD COLUMN "gender" "Gender";
ALTER TABLE "Contact" ADD COLUMN "city" TEXT;
ALTER TABLE "Contact" ADD COLUMN "district" TEXT;
CREATE INDEX "Contact_businessId_city_district_idx" ON "Contact"("businessId", "city", "district");

ALTER TABLE "Broadcast" ADD COLUMN "filters" JSONB NOT NULL DEFAULT '{}';
