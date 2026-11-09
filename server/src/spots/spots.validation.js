import { Category } from "../generated/prisma/enums.ts";

// The category list comes from the Prisma schema, so it can't drift from the database.
const CATEGORIES = Object.values(Category);
const NAME_MAX = 100;
const ADDRESS_MAX = 200;

// Required, trimmed text with a maximum length. Length counts characters as
// people see them ([...text] splits by Unicode code point), like passwords do.
function checkText(value, label, max) {
    if (typeof value !== "string" || value.trim() === "") {
        return { error: `${label} is required.` };
    }
    const clean = value.trim();
    if ([...clean].length > max) {
        return { error: `${label} must be at most ${max} characters.` };
    }
    return { clean };
}

// Only name, category and address come from the user. Everything else on a spot
// (who created it, coordinates, the Google place id) is set by the server.
export function validateSpot(body) {
    const errors = {};
    // Express 5 leaves req.body undefined when no body is sent.
    const { name, category, address } = body ?? {};

    const checkedName = checkText(name, "Name", NAME_MAX);
    if (checkedName.error) errors.name = checkedName.error;

    const checkedAddress = checkText(address, "Address", ADDRESS_MAX);
    if (checkedAddress.error) errors.address = checkedAddress.error;

    // Exact match: the front end offers a fixed list, so "cafe" is a mistake to report.
    if (typeof category !== "string" || category === "") {
        errors.category = "Category is required.";
    } else if (!CATEGORIES.includes(category)) {
        errors.category = `Category must be one of: ${CATEGORIES.join(", ")}.`;
    }

    return {
        errors,
        data: { name: checkedName.clean, category, address: checkedAddress.clean },
    };
}
