-- No free trial: the bot only works on a paid subscription.
UPDATE "Subscription" SET "status" = 'INCOMPLETE' WHERE "status" = 'TRIALING';

ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELED');
ALTER TABLE "Subscription" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus" USING ("status"::text::"SubscriptionStatus");
ALTER TABLE "Subscription" ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';
DROP TYPE "SubscriptionStatus_old";

ALTER TABLE "Subscription" DROP COLUMN "trialEndsAt";
