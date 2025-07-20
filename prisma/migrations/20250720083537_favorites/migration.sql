/*
  Warnings:

  - You are about to drop the column `dreamId` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Note` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[favoriteId]` on the table `Note` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `favoriteId` to the `Note` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_dreamId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_userId_fkey";

-- DropIndex
DROP INDEX "Note_userId_dreamId_key";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "dreamId",
DROP COLUMN "userId",
ADD COLUMN     "favoriteId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Note_favoriteId_key" ON "Note"("favoriteId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_favoriteId_fkey" FOREIGN KEY ("favoriteId") REFERENCES "Favorite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
