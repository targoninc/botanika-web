import {Signal} from "@targoninc/jess";
import {ApiResponse} from "./api.base.ts";

export function tryLoadFromCache<T>(key: string, value: Signal<T>, apiRequest: Promise<ApiResponse<T | string>>, getUpdateData: (data: T) => T = null) {
    const storeCacheKey = "storeCache_" + key;
    const cachedValue = localStorage.getItem(storeCacheKey);

    value.subscribe(newValue => {
        localStorage.setItem(storeCacheKey, JSON.stringify(newValue));
    })

    if (cachedValue) {
        try {
            value.value = JSON.parse(cachedValue) as T;
        } catch (e) {
            console.error(`Error parsing cached value for ${storeCacheKey}:`, e);
        }
    }

    if (!getUpdateData) {
        getUpdateData = (data: T) => data;
    }

    apiRequest.then(response => {
        if (response.success && response.data) {
            value.value = getUpdateData(response.data as T);
        }
    });
}