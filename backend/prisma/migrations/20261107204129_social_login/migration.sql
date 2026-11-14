-- Sign up / log in with Facebook or Instagram
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "fbUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "igUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
CREATE UNIQUE INDEX "User_fbUserId_key" ON "User"("fbUserId");
CREATE UNIQUE INDEX "User_igUserId_key" ON "User"("igUserId");
