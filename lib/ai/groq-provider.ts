import "server-only";

// Hard-disabled local foundation: no credentials, SDK, tools, fetch or enablement path.
export function getGroqAvailability(): { enabled: false; available: false } {
    return { enabled: false, available: false };
}

// A separate owner authorization/code checkpoint is required; no environment flag can enable a pilot.
export function getLocalGroqPilotAvailability(): { enabled: false } {
    return { enabled: false };
}
