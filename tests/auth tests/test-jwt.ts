import { createToken, verifyToken, } from "../../lib/auth/jwt";

async function main() {
  const token = await createToken({
    userId: 1,
    email: "admin@test.com",
    roleId: 1,
  });

  console.log("Generated Token:");
  console.log(token);

  console.log();

  const payload = await verifyToken(token);

  console.log("Decoded Payload:");
  console.log(payload);
}

main();