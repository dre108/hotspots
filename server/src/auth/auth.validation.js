export function validateSignup(body) {
    const errors = {};
    const { name, message } = body ?? {};

    let cleanName;
    if (typeof name !== "string" || name.trim() === "") {
        errors.name = "Name is required.";
    } else {
        cleanName = name.trim();
        if (cleanName.length > 50) {
            errors.name = "Name must be 50 characters or fewer.";
        }
    }

    if (typeof message !== "string" || message.trim() === "") {
        errors.message = "Message is required.";
    }

    return { errors, data: { name: cleanName, message } };
}