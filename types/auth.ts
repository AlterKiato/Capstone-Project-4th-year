import type { JWTPayload } from "jose";

/**
 * Data stored inside the JWT authentication token.
 */
export interface AuthTokenPayload extends JWTPayload {
    userId: number;
    email: string;
    roleId: number;
}

/**
 * Safe user information returned after authentication.
 *
 * Passwords and other sensitive information
 * must never be included here.
 */
export interface AuthUser {
    id: number;
    email: string;
    roleId: number;
    firstName: string;
    lastName: string;
}

/**
 * Defines the roles available in the system.
 *
 * These names correspond to the roles stored
 * in the database.
 */
export type UserRole =
    | "Admin"
    | "Adviser"
    | "Student"
    | "Panel";

/**
 * Standard response structure returned by services.
 *
 * T represents optional data returned when
 * the operation is successful.
 */
export interface ServiceResult<T = undefined> {
    success: boolean;
    message: string;
    data?: T;
}