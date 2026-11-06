import { afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { verify } from "@node-rs/argon2";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";

// These tests write to the dev database, so every account they create uses
// this email domain and gets deleted before each test and at the end.
const TEST_DOMAIN = "@signup.test";
const PASSWORD = "correct horse battery";

function newUser(overrides = {}) {
    return { email: `dre${TEST_DOMAIN}`, username: "signup_test", password: PASSWORD, ...overrides };
}

async function cleanUp() {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
}

beforeEach(cleanUp);

afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
});

describe("POST /auth/signup", () => {
    it("creates the account and returns it without the password hash", async () => {
        const res = await request(app).post("/auth/signup").send(newUser({ email: `  Dre${TEST_DOMAIN} ` }));

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ email: `dre${TEST_DOMAIN}`, username: "signup_test" });
        expect(res.body.id).toBeGreaterThan(0);
        expect(res.body).not.toHaveProperty("passwordHash");
        expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    });

    it("stores an Argon2id hash that verifies, never the plain password", async () => {
        await request(app).post("/auth/signup").send(newUser());

        const stored = await prisma.user.findUnique({ where: { email: `dre${TEST_DOMAIN}` } });
        expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
        expect(stored.passwordHash).not.toContain(PASSWORD);
        expect(await verify(stored.passwordHash, PASSWORD)).toBe(true);
        expect(await verify(stored.passwordHash, "wrong password here")).toBe(false);
    });

    it("returns every field's error for an empty body, and saves nothing", async () => {
        const res = await request(app).post("/auth/signup").send({});

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.errors).sort()).toEqual(["email", "password", "username"]);
        expect(await prisma.user.count({ where: { email: { endsWith: TEST_DOMAIN } } })).toBe(0);
    });

    it("rejects a short password with a 400", async () => {
        const res = await request(app).post("/auth/signup").send(newUser({ password: "too short" }));

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ errors: { password: "Password must be 15-128 characters." } });
    });

    it.each([
        ["email", { username: "someone_else" }],
        ["username, in any letter case", { email: `other${TEST_DOMAIN}`, username: "SIGNUP_TEST" }],
    ])("returns 409 when the %s is already taken, with one generic message", async (_, second) => {
        await request(app).post("/auth/signup").send(newUser());

        const res = await request(app).post("/auth/signup").send(newUser(second));

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: "Email or username is already taken." });
    });

    it("answers malformed JSON with the shared 400 JSON error", async () => {
        const res = await request(app)
            .post("/auth/signup")
            .set("Content-Type", "application/json")
            .send('{"email": ');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Request body must be valid JSON." });
    });
});
