/*
  Warnings:

  - The `gender` column on the `Patient` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[googleId]` on the table `Doctor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `Patient` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "_SavedDoctors" DROP CONSTRAINT "_SavedDoctors_A_fkey";

-- DropForeignKey
ALTER TABLE "_SavedDoctors" DROP CONSTRAINT "_SavedDoctors_B_fkey";

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "googleId" TEXT,
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "_SavedDoctors" ADD CONSTRAINT "_SavedDoctors_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_SavedDoctors_AB_unique";

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_googleId_key" ON "Doctor"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_googleId_key" ON "Patient"("googleId");

-- AddForeignKey
ALTER TABLE "_SavedDoctors" ADD CONSTRAINT "_SavedDoctors_A_fkey" FOREIGN KEY ("A") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SavedDoctors" ADD CONSTRAINT "_SavedDoctors_B_fkey" FOREIGN KEY ("B") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
