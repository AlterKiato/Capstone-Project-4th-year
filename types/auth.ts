import type { JWTPayload } from "jose";


export interface AuthTokenPayload extends JWTPayload {
    userId: number;
    email: string;
    roleId: number;
}

export interface AuthUser {
    id: number;
    email: string;
    roleID: number;
    firstName: string;
    lastName: string;
}

export interface ServiceResult<T = undefined>{
    success: boolean;
    message: String;
    data?: T;
}