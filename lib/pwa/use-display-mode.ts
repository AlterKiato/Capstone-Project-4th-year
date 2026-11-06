"use client";

import { useSyncExternalStore } from "react";
import { getDisplayMode, getServerDisplayMode, subscribeDisplayMode } from "./display-mode";
import { getPwaPlatform, getServerPwaPlatform, subscribePwaPlatform } from "./platform";

export function useDisplayMode() {
    return useSyncExternalStore(subscribeDisplayMode, getDisplayMode, getServerDisplayMode);
}

export function usePwaPlatform() {
    return useSyncExternalStore(subscribePwaPlatform, getPwaPlatform, getServerPwaPlatform);
}
