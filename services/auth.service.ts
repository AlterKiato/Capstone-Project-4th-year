import { db } from "@/lib/db"
import { users } from "@/db/schema/users"
import { role } from "@/db/schema/role"

import { eq } from "drizzle-orm"

import { hashPassword, comparePassword } from "@/lib/auth/hash"

import { createSession } from "@/lib/auth/session"

import type { LoginResult } from "@/types/auth"

import type { RegisterInput, LoginInput } from "@/lib/validations/auth"

export async function registerUser(data: RegisterInput): Promise<LoginResult> {
    throw new Error("this is empty for now")
}

export async function loginUser( data: LoginInput ): Promise<LoginResult>{
    throw new Error("this is empty for now")
}