import {Signal} from "@targoninc/jess";
import {ApiResponse} from "./api.base.ts";

/**
 * Loads data from localStorage cache and then updates it with fresh data from an API request
 * @param key The key to use for localStorage
 * @param value The signal to update with the data
 * @param apiRequest Function that returns a Promise with the API response
 * @param getUpdateData Optional function to transform the data before updating the signal
 */
export function tryLoadFromCache<T>(
    key: string, 
    value: Signal<T>, 
    apiRequest: (cached: T | null) => Promise<ApiResponse<T | string>>, 
    getUpdateData?: (data: T) => T
) {
    const storeCacheKey = "storeCache_" + key;
    const cachedValue = localStorage.getItem(storeCacheKey);

    value.subscribe(newValue => {
        localStorage.setItem(storeCacheKey, JSON.stringify(newValue));
    });

    if (cachedValue) {
        try {
            value.value = JSON.parse(cachedValue) as T;
        } catch (e) {
            console.error(`Error parsing cached value for ${storeCacheKey}:`, e);
        }
    }

    const updateFn = getUpdateData || ((data: T) => data);

    apiRequest(value.value).then(response => {
        if (response.success && response.data) {
            value.value = updateFn(response.data as T);
        }
    });
}