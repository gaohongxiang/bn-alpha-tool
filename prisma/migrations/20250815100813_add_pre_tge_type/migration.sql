-- CreateEnum
CREATE TYPE "public"."AirdropType" AS ENUM ('alpha', 'tge', 'pre_tge');

-- CreateTable
CREATE TABLE "public"."airdrops" (
    "id" SERIAL NOT NULL,
    "date" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currentPrice" TEXT,
    "points" INTEGER,
    "phase1Points" INTEGER,
    "phase2Points" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "phase1EndTime" TEXT,
    "phase2EndTime" TEXT,
    "supplementaryToken" DOUBLE PRECISION NOT NULL,
    "participants" INTEGER,
    "type" "public"."AirdropType" NOT NULL,
    "cost" DOUBLE PRECISION,
    "pointsConsumed" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airdrops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "airdrops_token_key" ON "public"."airdrops"("token");
