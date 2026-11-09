import { afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { hash, verify } from "@node-rs/argon2";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { verifyToken } from "../src/auth/tokens.js";

// Wrap the real verify() so a test can count calls (it still checks passwords).
vi.mock("@node-rs/argon2", async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, verify: vi.fn(real.verify) };
});

// These tests write to the dev database, so the account uses this email
// domain and gets deleted before each test and at the end.
const TEST_DOMAIN = "@login.test";
const EMAIL = `dre${TEST_DOMAIN}`;
const PASSWORD = "correct horse battery";
const LOGIN_FAILED = { error: "Wrong email or password." };

let user;

async function cleanUp() {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
}

beforeEach(async () => {
    await cleanUp();
    user = await prisma.user.create({
        data: { email: EMAIL, username: "login_test", passwordHash: await hash(PASSWORD) },
    });
    verify.mockClear();
});

afterAll(async () => {
    await cleanUp();
    await prisma.$disconnect();
});

function logIn(body) {
    return request(app).post("/auth/login").send(body);
}

describe("POST /auth/login", () => {
    it("returns a token for the right user, and the user without the hash", async () => {
        const res = await logIn({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.user).toEqual({
            id: user.id,
            email: EMAIL,
            username: "login_test",
            createdAt: user.createdAt.toISOString(),
        });
        expect(JSON.stringify(res.body)).not.toContain("argon2");

        const payload = await verifyToken(res.body.token);
        expect(payload.sub).toBe(String(user.id));
        expect(payload.username).toBe("login_test");
    });

    it("finds the account whatever the email's letter case or spacing", async () => {
        const res = await logIn({ email: `  DRE${TEST_DOMAIN.toUpperCase()} `, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.user.id).toBe(user.id);
    });

    it("rejects a wrong password with the generic 401", async () => {
        const res = await logIn({ email: EMAIL, password: "not the right password" });

        expect(res.status).toBe(401);
        expect(res.body).toEqual(LOGIN_FAILED);
        expect(res.body).not.toHaveProperty("token");
    });

    it("gives an unknown email the exact same 401 as a wrong password", async () => {
        const res = await logIn({ email: `nobody${TEST_DOMAIN}`, password: PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body).toEqual(LOGIN_FAILED);
    });

    it("still checks a password when the email doesn't exist (same timing)", async () => {
        await logIn({ email: `nobody${TEST_DOMAIN}`, password: PASSWORD });

        expect(verify).toHaveBeenCalledTimes(1);
    });

    it("does not trim the password", async () => {
        const res = await logIn({ email: EMAIL, password: ` ${PASSWORD} ` });

        expect(res.status).toBe(401);
    });

    it("returns 400 naming both fields when they're missing, without checking anything", async () => {
        const res = await logIn({});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ errors: { email: "Email is required.", password: "Password is required." } });
        expect(verify).not.toHaveBeenCalled();
    });

    it("returns 400 when no body is sent at all", async () => {
        const res = await request(app).post("/auth/login");

        expect(res.status).toBe(400);
        expect(Object.keys(res.body.errors).sort()).toEqual(["email", "password"]);
    });
});
