import { afterEach, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { SignJWT, decodeJwt } from "jose";
import { requireAuth } from "../src/middleware/require-auth.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { createToken, verifyToken } from "../src/auth/tokens.js";

// Wrap the real verifyToken so one test can make it fail like a bug would
// (every other test still checks tokens for real).
vi.mock("../src/auth/tokens.js", async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, verifyToken: vi.fn(real.verifyToken) };
});

const USER = { id: 42, username: "auth_test" };
const SIGN_IN_REQUIRED = { error: "Sign in required." };
const realKey = () => new TextEncoder().encode(process.env.JWT_SECRET);

// A tiny app used only by these tests: one protected route that reports
// who the middleware said the user is, and counts how often it runs.
const routeRan = vi.fn();
function makeTestApp() {
    const testApp = express();
    testApp.get("/private", requireAuth, (req, res) => {
        routeRan();
        res.json({ user: req.user });
    });
    testApp.use(errorHandler);
    return testApp;
}

function getPrivate(authorization) {
    const req = request(makeTestApp()).get("/private");
    return authorization === undefined ? req : req.set("Authorization", authorization);
}

afterEach(() => {
    routeRan.mockClear();
    vi.restoreAllMocks();
});

describe("requireAuth", () => {
    it("lets a valid token through and tells the route who the user is", async () => {
        const res = await getPrivate(`Bearer ${await createToken(USER)}`);

        expect(res.status).toBe(200);
        // id comes back as a number, ready for database queries.
        expect(res.body.user).toEqual({ id: 42, username: "auth_test" });
    });

    it('accepts "bearer" in any letter case and extra spaces before the token', async () => {
        const res = await getPrivate(`bEaReR   ${await createToken(USER)}`);

        expect(res.status).toBe(200);
    });

    it.each([
        ["no Authorization header", undefined],
        ["another scheme", "Basic ZHJlOnBhc3N3b3Jk"],
        ['"Bearer" with no token', "Bearer "],
        ["a token with no scheme", "eyJhbGciOiJIUzI1NiJ9.e30.abc"],
        ["a garbled token", "Bearer not-a-real-token"],
    ])("returns 401 for %s, without running the route", async (_, authorization) => {
        const res = await getPrivate(authorization);

        expect(res.status).toBe(401);
        expect(res.body).toEqual(SIGN_IN_REQUIRED);
        expect(res.headers["www-authenticate"]).toBe("Bearer");
        expect(routeRan).not.toHaveBeenCalled();
    });

    it("returns 401 for an edited token claiming to be another user", async () => {
        const token = await createToken(USER);
        const [header, , signature] = token.split(".");
        const forged = Buffer.from(JSON.stringify({ ...decodeJwt(token), sub: "1" })).toString("base64url");

        const res = await getPrivate(`Bearer ${header}.${forged}.${signature}`);

        expect(res.status).toBe(401);
        expect(res.body).toEqual(SIGN_IN_REQUIRED);
        expect(routeRan).not.toHaveBeenCalled();
    });

    it("returns 401 for an expired token", async () => {
        const now = Math.floor(Date.now() / 1000);
        const token = await new SignJWT({ username: USER.username })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject("42")
            .setIssuedAt(now - 7200)
            .setExpirationTime(now - 3600)
            .sign(realKey());

        const res = await getPrivate(`Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body).toEqual(SIGN_IN_REQUIRED);
    });

    it("returns 401 for a token signed with a different secret", async () => {
        const otherKey = new TextEncoder().encode("a-completely-different-secret-that-is-long-enough");
        const token = await new SignJWT({ username: USER.username })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject("42")
            .setExpirationTime("1h")
            .sign(otherKey);

        const res = await getPrivate(`Bearer ${token}`);

        expect(res.status).toBe(401);
    });

    it("sends a non-token failure to the error handler as a 500, not a 401", async () => {
        verifyToken.mockRejectedValueOnce(new Error("database exploded"));
        const logged = vi.spyOn(console, "error").mockImplementation(() => {});

        const res = await getPrivate(`Bearer ${await createToken(USER)}`);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Something went wrong." });
        expect(logged).toHaveBeenCalledOnce();
        expect(routeRan).not.toHaveBeenCalled();
    });
});
