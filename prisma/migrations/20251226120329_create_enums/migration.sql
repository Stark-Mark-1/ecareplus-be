-- Create Gender enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
        CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
    END IF;
END $$;

-- Create OnboardingStep enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingStep') THEN
        CREATE TYPE "OnboardingStep" AS ENUM ('EMAIL_VERIFIED', 'PERSONAL_INFO_COMPLETE', 'PROFESSIONAL_INFO_COMPLETE', 'AVAILABILITY_COMPLETE', 'COMPLETE');
    END IF;
END $$;

-- Create DayOfWeek enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek') THEN
        CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
    END IF;
END $$;

-- Convert Doctor.onboardingStep from INTEGER to OnboardingStep enum
-- First, add a temporary column with the enum type
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "onboardingStep_new" "OnboardingStep";

-- Map integer values to enum values (assuming 0=EMAIL_VERIFIED, 1=PERSONAL_INFO_COMPLETE, etc.)
UPDATE "Doctor" SET "onboardingStep_new" = 
    CASE 
        WHEN "onboardingStep" = 0 THEN 'EMAIL_VERIFIED'::"OnboardingStep"
        WHEN "onboardingStep" = 1 THEN 'PERSONAL_INFO_COMPLETE'::"OnboardingStep"
        WHEN "onboardingStep" = 2 THEN 'PROFESSIONAL_INFO_COMPLETE'::"OnboardingStep"
        WHEN "onboardingStep" = 3 THEN 'AVAILABILITY_COMPLETE'::"OnboardingStep"
        WHEN "onboardingStep" = 4 THEN 'COMPLETE'::"OnboardingStep"
        ELSE 'EMAIL_VERIFIED'::"OnboardingStep"
    END;

-- Make the new column NOT NULL
ALTER TABLE "Doctor" ALTER COLUMN "onboardingStep_new" SET NOT NULL;
ALTER TABLE "Doctor" ALTER COLUMN "onboardingStep_new" SET DEFAULT 'EMAIL_VERIFIED';

-- Drop the old column
ALTER TABLE "Doctor" DROP COLUMN IF EXISTS "onboardingStep";

-- Rename the new column
ALTER TABLE "Doctor" RENAME COLUMN "onboardingStep_new" TO "onboardingStep";

-- Convert Doctor.gender from TEXT to Gender enum (if column exists and has data)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Doctor' AND column_name = 'gender' AND data_type = 'text') THEN
        -- Add temporary column
        ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "gender_new" "Gender";
        
        -- Convert text values to enum (handle case-insensitive)
        UPDATE "Doctor" SET "gender_new" = 
            CASE UPPER(TRIM("gender"))
                WHEN 'MALE' THEN 'MALE'::"Gender"
                WHEN 'FEMALE' THEN 'FEMALE'::"Gender"
                WHEN 'OTHER' THEN 'OTHER'::"Gender"
                WHEN 'PREFER_NOT_TO_SAY' THEN 'PREFER_NOT_TO_SAY'::"Gender"
                ELSE NULL
            END
        WHERE "gender" IS NOT NULL;
        
        -- Drop old column and rename new one
        ALTER TABLE "Doctor" DROP COLUMN IF EXISTS "gender";
        ALTER TABLE "Doctor" RENAME COLUMN "gender_new" TO "gender";
    END IF;
END $$;

-- Convert Doctor.availableDays from TEXT[] to DayOfWeek[] (if column exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Doctor' AND column_name = 'availableDays' AND data_type = 'ARRAY') THEN
        -- Add temporary column
        ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "availableDays_new" "DayOfWeek"[];
        
        -- Convert text array to enum array
        UPDATE "Doctor" SET "availableDays_new" = 
            ARRAY(SELECT unnest("availableDays")::"DayOfWeek")
        WHERE "availableDays" IS NOT NULL;
        
        -- Drop old column and rename new one
        ALTER TABLE "Doctor" DROP COLUMN IF EXISTS "availableDays";
        ALTER TABLE "Doctor" RENAME COLUMN "availableDays_new" TO "availableDays";
    END IF;
END $$;

