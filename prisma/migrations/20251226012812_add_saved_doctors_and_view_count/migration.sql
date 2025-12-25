-- Add viewCount to Doctor table
ALTER TABLE "Doctor" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- Create junction table for many-to-many relationship between Patient and Doctor
CREATE TABLE "_SavedDoctors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Create indexes for the junction table
CREATE UNIQUE INDEX "_SavedDoctors_AB_unique" ON "_SavedDoctors"("A", "B");
CREATE INDEX "_SavedDoctors_B_index" ON "_SavedDoctors"("B");

-- Add foreign key constraints
ALTER TABLE "_SavedDoctors" ADD CONSTRAINT "_SavedDoctors_A_fkey" FOREIGN KEY ("A") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_SavedDoctors" ADD CONSTRAINT "_SavedDoctors_B_fkey" FOREIGN KEY ("B") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

