import { afterAll, beforeEach, describe, it, expect } from "vitest";
import { prisma } from "../src/db.js";

// These tests write to the dev database, so every row they create uses
// this email domain and gets deleted before each test and at the end.
const TEST_DOMAIN = "@spot-model.test";

async function cleanUp() {
    await prisma.spot.deleteMany({ where: { createdBy: { email: { endsWith: TEST_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
}

async function makeUser() {
    return prisma.user.create({
        data: { email: `owner${TEST_DOMAIN}`, username: "spot_owner_test", passwordHash: "not-a-real-hash" },
    });
}

beforeEach(cleanUp);

afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
});

describe("Spot model", () => {
    it("saves a spot linked to the user who created it", async () => {
        const user = await makeUser();

        const spot = await prisma.spot.create({
            data: { name: "Test Pizza", category: "Restaurant", address: "123 Test St, Chicago, IL", createdById: user.id },
            include: { createdBy: true },
        });

        expect(spot.id).toBeGreaterThan(0);
        expect(spot.createdBy.username).toBe("spot_owner_test");
        expect(spot.latitude).toBeNull();
        expect(spot.createdAt).toBeInstanceOf(Date);
    });

    it("rejects a category that isn't in the list", async () => {
        const user = await makeUser();

        await expect(
            prisma.spot.create({
                data: { name: "Test Gym", category: "Gym", address: "1 Test Ave", createdById: user.id },
            }),
        ).rejects.toThrow();
    });

    it("won't let two spots share the same Google place ID", async () => {
        const user = await makeUser();
        const data = { name: "Test Cafe", category: "Cafe", address: "2 Test Ave", googlePlaceId: "test-place-1", createdById: user.id };

        await prisma.spot.create({ data });

        await expect(prisma.spot.create({ data })).rejects.toThrow();
    });
});
