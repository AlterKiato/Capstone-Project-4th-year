import "server-only";

import {
    getSupabaseServerClient,
} from "@/lib/supabase/server";

/**
 * The Supabase Storage bucket used
 * for research submission documents.
 */
const RESEARCH_SUBMISSIONS_BUCKET =
    "research-submissions";

/**
 * Maximum file size accepted by the
 * application for a research submission.
 *
 * 10 MB is used for the initial
 * development implementation.
 */
const MAX_RESEARCH_FILE_SIZE =
    10 * 1024 * 1024;

/**
 * MIME types currently accepted
 * for research submission documents.
 *
 * PDF is the initial supported format.
 */
const ALLOWED_RESEARCH_FILE_TYPES = [
    "application/pdf",
];

/**
 * Represents the result of a successful
 * research document upload.
 */
export interface UploadedResearchDocument {
    path: string;
    fileName: string;
    contentType: string;
    size: number;
}

/**
 * Removes unsafe characters from a filename
 * before it is used as part of a Storage path.
 */
function sanitizeFileName(
    fileName: string
): string {
    const extensionIndex =
        fileName.lastIndexOf(".");

    const extension =
        extensionIndex >= 0
            ? fileName
                  .slice(extensionIndex)
                  .toLowerCase()
            : "";

    const baseName =
        extensionIndex >= 0
            ? fileName.slice(
                  0,
                  extensionIndex
              )
            : fileName;

    const sanitizedBaseName =
        baseName
            .trim()
            .replace(
                /[^a-zA-Z0-9-_]/g,
                "-"
            )
            .replace(
                /-+/g,
                "-"
            )
            .replace(
                /^-|-$/g,
                ""
            );

    return (
        (
            sanitizedBaseName ||
            "research-document"
        ) +
        extension
    );
}

/**
 * Uploads a research document to the
 * private Supabase Storage bucket.
 *
 * The application authorization checks
 * must happen before this function is called.
 */
export async function uploadResearchDocument(
    file: File,
    paperId: number,
    version: string
): Promise<UploadedResearchDocument> {
    if (!(file instanceof File)) {
        throw new Error(
            "Invalid research submission file."
        );
    }

    if (file.size <= 0) {
        throw new Error(
            "The research submission file is empty."
        );
    }

    if (
        file.size >
        MAX_RESEARCH_FILE_SIZE
    ) {
        throw new Error(
            "The research submission file must not exceed 10 MB."
        );
    }

    if (
        !ALLOWED_RESEARCH_FILE_TYPES.includes(
            file.type
        )
    ) {
        throw new Error(
            "Only PDF research documents are currently accepted."
        );
    }

    const sanitizedFileName =
        sanitizeFileName(
            file.name
        );

    const storagePath =
        `research/${paperId}/${version}/${sanitizedFileName}`;

    const supabase =
        getSupabaseServerClient();

    const fileBuffer =
        await file.arrayBuffer();

    const {
        data,
        error,
    } = await supabase.storage
        .from(
            RESEARCH_SUBMISSIONS_BUCKET
        )
        .upload(
            storagePath,
            fileBuffer,
            {
                contentType:
                    file.type ||
                    "application/pdf",
                cacheControl:
                    "3600",
                upsert: false,
            }
        );

    if (error) {
        console.error(
            "Supabase research document upload failed:",
            error
        );

        throw new Error(
            "The research document could not be uploaded."
        );
    }

    return {
        path: data.path,
        fileName:
            sanitizedFileName,
        contentType:
            file.type ||
            "application/pdf",
        size: file.size,
    };
}

/**
 * Creates a temporary signed URL
 * for downloading a private research document.
 *
 * The URL expires after the specified
 * number of seconds.
 */
export async function createResearchDocumentSignedUrl(
    storagePath: string,
    expiresIn = 3600
): Promise<string> {
    if (!storagePath.trim()) {
        throw new Error(
            "Research document path is required."
        );
    }

    const supabase =
        getSupabaseServerClient();

    const {
        data,
        error,
    } = await supabase.storage
        .from(
            RESEARCH_SUBMISSIONS_BUCKET
        )
        .createSignedUrl(
            storagePath,
            expiresIn
        );

    if (error) {
        console.error(
            "Supabase signed URL creation failed:",
            error
        );

        throw new Error(
            "The research document URL could not be created."
        );
    }

    return data.signedUrl;
}

/**
 * Deletes a research document
 * from the private Storage bucket.
 */
export async function deleteResearchDocument(
    storagePath: string
): Promise<void> {
    if (!storagePath.trim()) {
        throw new Error(
            "Research document path is required."
        );
    }

    const supabase =
        getSupabaseServerClient();

    const {
        error,
    } = await supabase.storage
        .from(
            RESEARCH_SUBMISSIONS_BUCKET
        )
        .remove([
            storagePath,
        ]);

    if (error) {
        console.error(
            "Supabase research document deletion failed:",
            error
        );

        throw new Error(
            "The research document could not be deleted."
        );
    }
}