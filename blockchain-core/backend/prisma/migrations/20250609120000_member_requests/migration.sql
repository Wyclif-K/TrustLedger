-- CreateEnum
CREATE TYPE "MemberRequestType" AS ENUM ('SAVINGS_DEPOSIT', 'LOAN_REPAYMENT');

-- CreateEnum
CREATE TYPE "MemberRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "member_requests" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "MemberRequestType" NOT NULL,
    "status" "MemberRequestStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "metadata" JSONB,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_requests_reference_key" ON "member_requests"("reference");

-- CreateIndex
CREATE INDEX "member_requests_memberId_idx" ON "member_requests"("memberId");

-- CreateIndex
CREATE INDEX "member_requests_status_idx" ON "member_requests"("status");

-- CreateIndex
CREATE INDEX "member_requests_type_idx" ON "member_requests"("type");
