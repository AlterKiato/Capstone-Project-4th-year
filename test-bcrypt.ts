import { hashPassword, comparePassword } from "./lib/auth/hash";

 async function main() {
    const password = "Admin123";

    const hashed = await hashPassword(password);

    console.log("Hash:", hashed);

    console.log("Correct:", await comparePassword(password, hashed));

    console.log("Wrong:", await comparePassword("wrongpassword", hashed));
 }

 main();