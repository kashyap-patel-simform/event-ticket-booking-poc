-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('active', 'expired', 'converted', 'released');

-- AlterTable
ALTER TABLE "Seat" ADD COLUMN     "holdId" TEXT;

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hold_userId_idx" ON "Hold"("userId");

-- CreateIndex
CREATE INDEX "Hold_status_expiresAt_idx" ON "Hold"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Seat_holdId_idx" ON "Seat"("holdId");

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "Hold"("id") ON DELETE SET NULL ON UPDATE CASCADE;
