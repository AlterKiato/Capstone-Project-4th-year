export type MainAdviserChoice = { id: number; firstName: string; lastName: string; email: string };
export type MainAdviserConfiguration = {
    revision: number;
    current: (MainAdviserChoice & { eligible: boolean }) | null;
    eligibleAdvisers: MainAdviserChoice[];
};
export type MainAdviserResult = {
    success: boolean;
    kind: "success" | "denied" | "validation" | "ineligible" | "stale" | "unchanged" | "unavailable" | "uncertain";
    message: string;
    uncertain?: boolean;
};
