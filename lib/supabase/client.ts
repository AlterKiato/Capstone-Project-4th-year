import "server-only";

import {
    createClient,
} from "@supabase/supabase-js";

/**
 * Creates a server-side Supabase client.
 *
 * The client uses the Supabase publishable key
 * and is restricted to server-side application code.
 */
export function getSupabaseServerClient() {
    const supabaseUrl =
        process.env.SUPABASE_URL;

    const supabasePublishableKey =
        process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl) {
        throw new Error(
            "SUPABASE_URL is not configured."
        );
    }

    if (!supabasePublishableKey) {
        throw new Error(
            "SUPABASE_PUBLISHABLE_KEY is not configured."
        );
    }

    return createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}