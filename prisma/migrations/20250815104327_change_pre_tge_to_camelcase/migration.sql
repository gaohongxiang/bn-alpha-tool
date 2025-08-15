/*
  Warnings:

  - The values [pre_tge] on the enum `AirdropType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AirdropType_new" AS ENUM ('alpha', 'tge', 'preTge');
ALTER TABLE "public"."airdrops" ALTER COLUMN "type" TYPE "public"."AirdropType_new" USING ("type"::text::"public"."AirdropType_new");
ALTER TYPE "public"."AirdropType" RENAME TO "AirdropType_old";
ALTER TYPE "public"."AirdropType_new" RENAME TO "AirdropType";
DROP TYPE "public"."AirdropType_old";
COMMIT;
