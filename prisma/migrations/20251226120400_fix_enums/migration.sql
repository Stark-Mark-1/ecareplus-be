-- Ensure all enum types exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
        CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingStep') THEN
        CREATE TYPE "OnboardingStep" AS ENUM ('EMAIL_VERIFIED', 'PERSONAL_INFO_COMPLETE', 'PROFESSIONAL_INFO_COMPLETE', 'AVAILABILITY_COMPLETE', 'COMPLETE');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek') THEN
        CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
    END IF;
END $$;

-- Fix gender column if it's still TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Doctor' 
        AND column_name = 'gender' 
        AND data_type = 'text'
    ) THEN
        -- Add temporary column
        ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "gender_temp" "Gender";
        
        -- Convert text values to enum (handle case-insensitive)
        UPDATE "Doctor" SET "gender_temp" = 
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
        ALTER TABLE "Doctor" RENAME COLUMN "gender_temp" TO "gender";
    END IF;
END $$;

-- Fix onboardingStep if it's still INTEGER
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Doctor' 
        AND column_name = 'onboardingStep' 
        AND data_type = 'integer'
    ) THEN
        -- Add temporary column
        ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "onboardingStep_temp" "OnboardingStep";
        
        -- Map integer values to enum values
        UPDATE "Doctor" SET "onboardingStep_temp" = 
            CASE 
                WHEN "onboardingStep" = 0 THEN 'EMAIL_VERIFIED'::"OnboardingStep"
                WHEN "onboardingStep" = 1 THEN 'PERSONAL_INFO_COMPLETE'::"OnboardingStep"
                WHEN "onboardingStep" = 2 THEN 'PROFESSIONAL_INFO_COMPLETE'::"OnboardingStep"
                WHEN "onboardingStep" = 3 THEN 'AVAILABILITY_COMPLETE'::"OnboardingStep"
                WHEN "onboardingStep" = 4 THEN 'COMPLETE'::"OnboardingStep"
                ELSE 'EMAIL_VERIFIED'::"OnboardingStep"
            END;
        
        -- Make NOT NULL and set default
        ALTER TABLE "Doctor" ALTER COLUMN "onboardingStep_temp" SET NOT NULL;
        ALTER TABLE "Doctor" ALTER COLUMN "onboardingStep_temp" SET DEFAULT 'EMAIL_VERIFIED';
        
        -- Drop old column and rename new one
        ALTER TABLE "Doctor" DROP COLUMN IF EXISTS "onboardingStep";
        ALTER TABLE "Doctor" RENAME COLUMN "onboardingStep_temp" TO "onboardingStep";
    END IF;
END $$;

