import { loginSchema } from "../../lib/validations/auth";

const result = loginSchema.safeParse({
    email: "student@test.com",
    password: "Password123",
});

console.log(result);