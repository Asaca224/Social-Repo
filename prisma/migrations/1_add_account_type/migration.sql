-- CreateEnum
CREATE TYPE "SocialAccountType" AS ENUM ('business', 'creator', 'personal');

-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN     "account_type" "SocialAccountType";

