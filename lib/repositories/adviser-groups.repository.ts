import "server-only";
import { and, asc, desc, eq, notExists } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, researchGroups, researchPapers, users } from "@/db/schema";
import { ROLE_IDS } from "@/lib/auth/roles";

export async function readAdviserGroups(adviserId: number) {
    const owned = eq(researchGroups.adviserId, adviserId);
    // Preserve the existing unpaginated owned directory without per-row reads.
    const [groups, members, projects] = await Promise.all([
        db.select({ id: researchGroups.id, groupName: researchGroups.groupName,
            strand: researchGroups.strand, section: researchGroups.section,
            schoolYear: researchGroups.schoolYear, status: researchGroups.status,
        }).from(researchGroups).where(owned).orderBy(desc(researchGroups.createdAt), desc(researchGroups.id)),
        db.select({ id: groupMembers.id, groupId: groupMembers.groupId, userId: users.id,
            firstName: users.firstName, lastName: users.lastName, email: users.email,
        }).from(groupMembers).innerJoin(researchGroups, eq(groupMembers.groupId, researchGroups.id))
            .innerJoin(users, eq(groupMembers.userId, users.id)).where(owned)
            .orderBy(asc(users.lastName), asc(users.firstName), asc(groupMembers.id)),
        db.select({ id: researchPapers.id, groupId: researchPapers.groupId,
            title: researchPapers.title, status: researchPapers.status,
        }).from(researchPapers).innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
            .where(owned).orderBy(desc(researchPapers.createdAt), desc(researchPapers.id)),
    ]);
    return groups.map(group => ({ ...group,
        members: members.filter(member => member.groupId === group.id),
        projects: projects.filter(project => project.groupId === group.id),
    }));
}

export async function readEligibleGroupStudents(groupId: number) {
    return db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(users).where(and(eq(users.roleId, ROLE_IDS.STUDENT),
            notExists(db.select({ id: groupMembers.id }).from(groupMembers)
                .innerJoin(researchGroups, eq(groupMembers.groupId, researchGroups.id))
                .where(and(eq(groupMembers.userId, users.id), eq(researchGroups.status, "active")))),
            notExists(db.select({ id: groupMembers.id }).from(groupMembers)
                .where(and(eq(groupMembers.userId, users.id), eq(groupMembers.groupId, groupId))))))
        .orderBy(asc(users.lastName), asc(users.firstName), asc(users.id));
}
