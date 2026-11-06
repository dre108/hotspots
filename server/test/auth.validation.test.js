import { describe, it, expect } from "vitest";
import { validateSignup } from "../src/auth/auth.validation.js";

const VALID = { email: "dre@example.com", username: "dre_108", password: "correct horse battery" };

describe("validateSignup", () => {
    it("accepts valid input and cleans it up", () => {
        const { errors, data } = validateSignup({
            email: "  Dre@Example.COM ",
            username: "  Dre_108 ",
            password: "  spaces count too  ",
        });

        expect(errors).toEqual({});
        expect(data).toEqual({ email: "dre@example.com", username: "dre_108", password: "  spaces count too  " });
    });

    it.each([undefined, {}])("reports every missing field when the body is %s", (body) => {
        const { errors } = validateSignup(body);

        expect(errors).toEqual({
            email: "Email is required.",
            username: "Username is required.",
            password: "Password is required.",
        });
    });

    it.each([123, null, ["a@b.co"], "   "])("treats %j as a missing email", (email) => {
        expect(validateSignup({ ...VALID, email }).errors).toEqual({ email: "Email is required." });
    });

    describe("email", () => {
        it.each(["no-at-sign.com", "a@b", "a b@c.com", "@example.com", "dre@.com"])("rejects %s", (email) => {
            expect(validateSignup({ ...VALID, email }).errors).toEqual({ email: "Enter a valid email address." });
        });

        it("allows 254 characters and rejects 255", () => {
            const atLimit = `${"a".repeat(242)}@example.com`; // 242 + 12 = 254
            expect(atLimit).toHaveLength(254);
            expect(validateSignup({ ...VALID, email: atLimit }).errors).toEqual({});
            expect(validateSignup({ ...VALID, email: `a${atLimit}` }).errors).toHaveProperty("email");
        });
    });

    describe("username", () => {
        it.each(["abc", "a".repeat(20), "under_score_9"])("accepts %s", (username) => {
            expect(validateSignup({ ...VALID, username }).errors).toEqual({});
        });

        it.each(["ab", "a".repeat(21), "has space", "dash-name", "dot.name", "émile"])("rejects %s", (username) => {
            expect(validateSignup({ ...VALID, username }).errors).toEqual({
                username: "Username must be 3-20 characters: letters, numbers, or underscores.",
            });
        });
    });

    describe("password", () => {
        it("allows 15 and 128 characters, rejects 14 and 129", () => {
            for (const ok of [15, 128]) {
                expect(validateSignup({ ...VALID, password: "p".repeat(ok) }).errors).toEqual({});
            }
            for (const bad of [14, 129]) {
                expect(validateSignup({ ...VALID, password: "p".repeat(bad) }).errors).toEqual({
                    password: "Password must be 15-128 characters.",
                });
            }
        });

        it("counts an emoji as one character, not two", () => {
            const password = "🔒".repeat(15); // .length is 30, but it's 15 characters
            expect(password.length).toBe(30);
            expect(validateSignup({ ...VALID, password }).errors).toEqual({});
            expect(validateSignup({ ...VALID, password: "🔒".repeat(14) }).errors).toHaveProperty("password");
        });

        it("doesn't trim spaces into a valid password", () => {
            // Spaces are real characters and are never trimmed, so 15 spaces
            // is 15 characters (a blocklist of weak passwords is a later step).
            expect(validateSignup({ ...VALID, password: " ".repeat(15) }).errors).toEqual({});
            expect(validateSignup({ ...VALID, password: "" }).errors).toEqual({ password: "Password is required." });
        });
    });
});
