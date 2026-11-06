// Shared by every route that takes a numeric id in the URL (/spots/:id, /spots/:spotId/reviews, ...).

// Postgres INTEGER tops out at 2,147,483,647. Anything bigger would make
// Prisma throw, so it's rejected here as a bad id instead.
const MAX_ID = 2147483647;

// Returns the id as a number, or null if it can't be a valid id
// (not a whole number, zero, negative, or too big).
export function parseId(value) {
    if (!/^\d+$/.test(value)) return null;
    const id = Number(value);
    if (id < 1 || id > MAX_ID) return null;
    return id;
}
