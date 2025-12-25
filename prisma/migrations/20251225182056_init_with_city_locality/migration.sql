-- CreateTable
CREATE TABLE "Doctor" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "languages" TEXT[],
    "contactNumber" TEXT,
    "whatsappNumber" TEXT,
    "specialty" TEXT,
    "yearsOfExperience" INTEGER,
    "latestQualification" TEXT,
    "address" TEXT,
    "city" TEXT,
    "locality" TEXT,
    "availableDays" TEXT[],
    "availableTiming" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "otp" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_email_key" ON "Doctor"("email");
