-- CreateEnum
CREATE TYPE "Category" AS ENUM ('Restaurant', 'Cafe', 'Bar', 'Park', 'Shop', 'Entertainment', 'Other');

-- CreateTable
CREATE TABLE "Spot" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googlePlaceId" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Spot_googlePlaceId_key" ON "Spot"("googlePlaceId");

-- AddForeignKey
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
