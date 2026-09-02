import "dotenv/config";

import { db } from "@/lib/db";
import { role } from "@/db/schema";

async function seedRoles() {
    await db
        .insert(role)
        .values([
            {
                name: "Admin",
                description: "Admin role with full access to the system.",
            },
            {
                name: "Adviser",
                description: "Adviser role with limited access to the system.",
            },
            {
                name: "User",
                description: "User role with standard access to the system.",
            },
            {
                name: "Panel",
                description: "Panel member responsible for evaluating and providing feedback on projects.",
            },
        ])
        .onConflictDoNothing();

    console.log("Roles seeded successfully.");
}

seedRoles()
    .catch((error) => {
        console.error("Error seeding roles:", error);
        process.exit(1);
    });