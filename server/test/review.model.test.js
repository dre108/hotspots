import { afterAll, beforeEach, describe, it, expect } from "vitest";
import { prisma } from "../src/db.js";

// These tests write to the dev database, so every row they create uses
// this email domain and gets deleted before each test and at the end.
const TEST_DOMAIN = "@review-model.test";

async function cleanUp() {
    const ours = { email: { endsWith: TEST_DOMAIN } };
    await prisma.review.deleteMany({ where: { user: ours } });
    await prisma.spot.deleteMany({ where: { createdBy: ours } });
    await prisma.user.deleteMany({ where: ours });
}

async function makeUser(name) {
    return prisma.user.create({
        data: { email: `${name}${TEST_DOMAIN}`, username: `${name}_review_test`, passwordHash: "not-a-real-hash" },
    });
}

async function makeSpot(owner, name = "Test Diner") {
    return prisma.spot.create({
        data: { name, category: "Restaurant", address: "10 Test St", createdById: owner.id },
    });
}

beforeEach(cleanUp);

afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
});

describe("Review model", () => {
    it("saves a review linked to its user and spot, with the comment optional", async () => {
        const user = await makeUser("alice");
        const spot = await makeSpot(user);

        const review = await prisma.review.create({
            data: { rating: 5, userId: user.id, spotId: spot.id },
            include: { user: true, spot: true },
        });

        expect(review.user.username).toBe("alice_review_test");
        expect(review.spot.name).toBe("Test Diner");
        expect(review.comment).toBeNull();
        expect(review.updatedAt).toBeInstanceOf(Date);
    });

    it("allows only one review per person per spot", async () => {
        const user = await makeUser("bob");
        const spot = await makeSpot(user);
        await prisma.review.create({ data: { rating: 4, userId: user.id, spotId: spot.id } });

        await expect(
            prisma.review.create({ data: { rating: 2, userId: user.id, spotId: spot.id } }),
        ).rejects.toMatchObject({ code: "P2002" });
    });

    it("lets the same person review a different spot", async () => {
        const user = await makeUser("cara");
        const first = await makeSpot(user, "First Spot");
        const second = await makeSpot(user, "Second Spot");
        await prisma.review.create({ data: { rating: 3, userId: user.id, spotId: first.id } });

        const review = await prisma.review.create({ data: { rating: 4, userId: user.id, spotId: second.id } });

        expect(review.spotId).toBe(second.id);
    });

    it.each([0, 6, -1])("rejects a rating of %i (database CHECK, 1-5 only)", async (rating) => {
        const user = await makeUser("dan");
        const spot = await makeSpot(user);

        await expect(
            prisma.review.create({ data: { rating, userId: user.id, spotId: spot.id } }),
        ).rejects.toThrow(/Review_rating_check/);
    });

    it("deletes a spot's reviews when the spot is deleted", async () => {
        const user = await makeUser("eve");
        const spot = await makeSpot(user);
        await prisma.review.create({ data: { rating: 5, userId: user.id, spotId: spot.id } });

        await prisma.spot.delete({ where: { id: spot.id } });

        expect(await prisma.review.count({ where: { spotId: spot.id } })).toBe(0);
    });

    it("refuses to delete a user who still has reviews", async () => {
        const owner = await makeUser("fay");
        const reviewer = await makeUser("gus");
        const spot = await makeSpot(owner);
        await prisma.review.create({ data: { rating: 4, userId: reviewer.id, spotId: spot.id } });

        await expect(prisma.user.delete({ where: { id: reviewer.id } })).rejects.toThrow();
    });
});
