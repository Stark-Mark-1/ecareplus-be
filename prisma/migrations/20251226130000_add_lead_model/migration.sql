-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_doctorId_patientId_key" ON "Lead"("doctorId", "patientId");

-- CreateIndex
CREATE INDEX "Lead_doctorId_idx" ON "Lead"("doctorId");

-- CreateIndex
CREATE INDEX "Lead_patientId_idx" ON "Lead"("patientId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

