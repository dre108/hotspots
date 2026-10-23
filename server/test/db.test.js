import { afterAll, describe, it, expect } from "vitest";
import { prisma } from "../src/db.js";

afterAll(async () => {
    await prisma.$disconnect();
});

describe("database connection", () => {
    it("can query the User table", async () => {
        const count = await prisma.user.count();

        expect(count).toBeGreaterThanOrEqual(0);
    });
});
