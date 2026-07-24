import "dotenv/config";

import {  registerUser  } from "@/lib/services/auth.service";

async function main () {
    const result = await registerUser({
        firstName: "Kent",
        lastName: "Ybarrita",
        email: "KYbarrita@test.com",
        password: "admin123",
        confirmPassword: "admin123",
        roleId: 1,
    });

    console.log(result);
} 

main();