import { describe, it, expect } from "vitest";
import { validateSpot } from "../src/spots/spots.validation.js";

const VALID = { name: "Joe's Pizza", category: "Restaurant", address: "1 Main St, Chicago" };

describe("validateSpot", () => {
    it("accepts a valid spot and trims name and address", () => {
        const { errors, data } = validateSpot({ name: "  Joe's Pizza ", category: "Restaurant", address: " 1 Main St, Chicago  " });

        expect(errors).toEqual({});
        expect(data).toEqual(VALID);
    });

    it("keeps only name, category and address, whatever else is sent", () => {
        const { data } = validateSpot({ ...VALID, createdById: 1, latitude: 41.9, googlePlaceId: "fake", id: 7 });

        expect(Object.keys(data).sort()).toEqual(["address", "category", "name"]);
    });

    it("names every missing field, and handles no body at all", () => {
        const required = {
            name: "Name is required.",
            category: "Category is required.",
            address: "Address is required.",
        };
        expect(validateSpot({}).errors).toEqual(required);
        expect(validateSpot(undefined).errors).toEqual(required);
    });

    it.each([
        ["blank strings", { name: "   ", address: "  " }],
        ["numbers", { name: 42, address: 7 }],
        ["arrays", { name: ["Joe's"], address: ["1 Main St"] }],
    ])("treats %s as missing", (_, fields) => {
        const { errors } = validateSpot({ ...VALID, ...fields });

        expect(errors).toEqual({ name: "Name is required.", address: "Address is required." });
    });

    it("allows exactly 100 characters in a name and 200 in an address, but not one more", () => {
        expect(validateSpot({ ...VALID, name: "a".repeat(100), address: "b".repeat(200) }).errors).toEqual({});
        expect(validateSpot({ ...VALID, name: "a".repeat(101), address: "b".repeat(201) }).errors).toEqual({
            name: "Name must be at most 100 characters.",
            address: "Address must be at most 200 characters.",
        });
    });

    it("counts an emoji as one character, not two", () => {
        // "🍕".length is 2 in JavaScript (UTF-16), but a person sees one character.
        expect(validateSpot({ ...VALID, name: "🍕".repeat(100) }).errors).toEqual({});
    });

    it("checks length after trimming", () => {
        expect(validateSpot({ ...VALID, name: ` ${"a".repeat(100)} ` }).errors).toEqual({});
    });

    it.each(["cafe", "CAFE", "Coffee", " Cafe"])("rejects the category %j and lists the valid ones", (category) => {
        const { errors } = validateSpot({ ...VALID, category });

        expect(errors).toEqual({
            category: "Category must be one of: Restaurant, Cafe, Bar, Park, Shop, Entertainment, Other.",
        });
    });

    it("accepts every category in the schema", () => {
        for (const category of ["Restaurant", "Cafe", "Bar", "Park", "Shop", "Entertainment", "Other"]) {
            expect(validateSpot({ ...VALID, category }).errors).toEqual({});
        }
    });
});
