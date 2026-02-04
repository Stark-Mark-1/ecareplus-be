-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "OnboardingStep" ADD VALUE 'PAYMENT_INFO_COMPLETE';

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankBeneficiaryName" TEXT,
ADD COLUMN     "bankIfsc" TEXT,
ADD COLUMN     "consultationFee" INTEGER,
ADD COLUMN     "razorpayAccountId" TEXT;
