-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create PatientOnboardingStep enum
CREATE TYPE "PatientOnboardingStep" AS ENUM ('EMAIL_VERIFIED', 'PERSONAL_INFO_COMPLETE');

-- Add new columns to Patient table
ALTER TABLE "Patient" ADD COLUMN "email" TEXT;
ALTER TABLE "Patient" ADD COLUMN "password" TEXT;
ALTER TABLE "Patient" ADD COLUMN "phone" TEXT;
ALTER TABLE "Patient" ADD COLUMN "gender" TEXT;
ALTER TABLE "Patient" ADD COLUMN "age" INTEGER;
ALTER TABLE "Patient" ADD COLUMN "city" TEXT;
ALTER TABLE "Patient" ADD COLUMN "onboardingStep" "PatientOnboardingStep" NOT NULL DEFAULT 'EMAIL_VERIFIED';
ALTER TABLE "Patient" ADD COLUMN "otp" TEXT;
ALTER TABLE "Patient" ADD COLUMN "otpExpiry" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add new UUID column
ALTER TABLE "Patient" ADD COLUMN "id_new" TEXT;

-- Generate UUIDs for existing records
UPDATE "Patient" SET "id_new" = uuid_generate_v4()::text;

-- Make the new column NOT NULL
ALTER TABLE "Patient" ALTER COLUMN "id_new" SET NOT NULL;

-- Make email unique and not null
ALTER TABLE "Patient" ALTER COLUMN "email" SET NOT NULL;
CREATE UNIQUE INDEX "Patient_email_key" ON "Patient"("email");

-- Drop the old primary key constraint
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_pkey";

-- Drop the old id column
ALTER TABLE "Patient" DROP COLUMN "id";

-- Rename the new column to id
ALTER TABLE "Patient" RENAME COLUMN "id_new" TO "id";

-- Add primary key constraint on the new id column
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_pkey" PRIMARY KEY ("id");

-- Make name nullable (since it's optional during onboarding)
ALTER TABLE "Patient" ALTER COLUMN "name" DROP NOT NULL;

