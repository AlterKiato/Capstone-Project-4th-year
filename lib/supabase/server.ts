import "server-only";

import {
    createClient,
} from "@supabase/supabase-js";

/**
 * Creates a server-only Supabase client
 * using the project's secret key.
 *
 * This client is intended for trusted
 * backend operations such as file uploads.
 *
 * The secret key bypasses Supabase RLS,
 * so application-level authorization must
 * happen before calling this client.
 */
export function getSupabaseServerClient() {
    const supabaseUrl =
        process.env.SUPABASE_URL;

    const supabaseSecretKey =
        process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
        throw new Error(
            "SUPABASE_URL is not configured."
        );
    }

    if (!supabaseSecretKey) {
        throw new Error(
            "SUPABASE_SECRET_KEY is not configured."
        );
    }

    return createClient(
        supabaseUrl,
        supabaseSecretKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
        }
    );
}