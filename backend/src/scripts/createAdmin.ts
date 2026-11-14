/**
 * Create a platform admin for /admin, or reset an existing admin's password.
 *
 *   npm run admin:create -- <email> [name]
 *
 * The password comes from ADMIN_PASSWORD, or a strong random one is generated and printed once.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.ts";

const [emailArg, ...nameParts] = process.argv.slice(2);
const email = emailArg?.toLowerCase().trim();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:create -- <email> [name]");
  process.exit(1);
}
const name = nameParts.join(" ").trim() || "Admin";
const fromEnv = process.env.ADMIN_PASSWORD;
if (fromEnv !== undefined && fromEnv.length < 10) {
  console.error("ADMIN_PASSWORD must be at least 10 characters");
  process.exit(1);
}
const password = fromEnv || randomBytes(12).toString("base64url");
const passwordHash = await bcrypt.hash(password, 12);

const existing = await prisma.admin.findUnique({ where: { email } });
if (existing) {
  await prisma.admin.update({ where: { email }, data: { passwordHash } });
  console.log(`🔑 Password reset for admin ${email}`);
} else {
  await prisma.admin.create({ data: { email, name, passwordHash } });
  console.log(`✅ Admin created: ${email}`);
}
if (!fromEnv) console.log(`   Password: ${password}   (shown once — change it in /admin → Тохиргоо)`);
await prisma.$disconnect();
