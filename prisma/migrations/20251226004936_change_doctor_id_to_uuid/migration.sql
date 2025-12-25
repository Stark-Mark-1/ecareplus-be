-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add new UUID column
ALTER TABLE "Doctor" ADD COLUMN "id_new" TEXT;

-- Generate UUIDs for existing records
UPDATE "Doctor" SET "id_new" = uuid_generate_v4()::text;

-- Make the new column NOT NULL
ALTER TABLE "Doctor" ALTER COLUMN "id_new" SET NOT NULL;

-- Drop the old primary key constraint
ALTER TABLE "Doctor" DROP CONSTRAINT "Doctor_pkey";

-- Drop the old id column
ALTER TABLE "Doctor" DROP COLUMN "id";

-- Rename the new column to id
ALTER TABLE "Doctor" RENAME COLUMN "id_new" TO "id";

-- Add primary key constraint on the new id column
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id");

-- Add updatedAt column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Doctor' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Doctor" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

