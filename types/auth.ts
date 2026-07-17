import type { JWTPayload } from "jose";


export interface AuthTokenPayload extends JWTPayload {
    userId: number;
    email: string;
    roleId: number;
}