// This part of folder contains the authentications utilities only

import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(password:string) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashPassword: string) {
    return bcrypt.compare(password, hashPassword);
}