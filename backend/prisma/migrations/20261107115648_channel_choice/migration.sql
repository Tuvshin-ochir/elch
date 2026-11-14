-- Channel choice: connect a Facebook page and/or a standalone Instagram account,
-- and choose per connection which channel(s) the bot automates.

-- CreateEnum
CREATE TYPE "ConnectionKind" AS ENUM ('FACEBOOK_LOGIN', 'INSTAGRAM_LOGIN');

-- New columns (botEnabled is split into fbEnabled / igEnabled, keeping existing values)
ALTER TABLE "ConnectedPage"
ADD COLUMN     "fbEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "igEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kind" "ConnectionKind" NOT NULL DEFAULT 'FACEBOOK_LOGIN',
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ALTER COLUMN "fbPageId" DROP NOT NULL;

UPDATE "ConnectedPage" SET "fbEnabled" = "botEnabled", "igEnabled" = "botEnabled";

ALTER TABLE "ConnectedPage" DROP COLUMN "botEnabled";
