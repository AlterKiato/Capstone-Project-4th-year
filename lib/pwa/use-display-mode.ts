"use client";

import { useSyncExternalStore } from "react";
import { getDisplayMode, getServerDisplayMode, subscribeDisplayMode } from "./display-mode";

export function useDisplayMode() {
    return useSyncExternalStore(subscribeDisplayMode, getDisplayMode, getServerDisplayMode);
}
