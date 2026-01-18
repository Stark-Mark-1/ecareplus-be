/*
  Warnings:

  - You are about to drop the column `meetingLink` on the `Appointment` table. All the data in the column will be lost.
  - Added the required column `scheduledEnd` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "meetingLink",
ADD COLUMN     "meetingName" TEXT,
ADD COLUMN     "scheduledEnd" TIMESTAMP(3) NOT NULL;
