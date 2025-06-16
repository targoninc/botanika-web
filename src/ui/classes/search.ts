/**
 * Performs a deep search on an array of objects based on provided property names and a search string.
 *
 * @param properties - List of top-level property names to search in.
 * @param array - The array of objects to filter.
 * @param searchString - The search string to find in the properties.
 * @returns Filtered array of objects that contain the search string in one of the provided property names.
 */
export function searchList<T>(properties: (keyof T)[], array: Array<T>, searchString: string): Array<T> {
    searchString = searchString.toLowerCase();
    const tokens = searchString.split(/\s+/);

    function hasToken(str: string, token: string) {
        return str.toLowerCase().includes(token);
    }

    function hasAllTokens(str: string, tokens: string[]) {
        return tokens.every(t => hasToken(str, t));
    }

    function searchObject(obj: T) {
        if (obj.constructor !== Object) {
            return false;
        }

        for (const key of properties) {
            if (obj.hasOwnProperty(key)) {
                // @ts-ignore
                const value = obj[key];

                if (value.constructor === String && hasAllTokens(value as string, tokens)) {
                    return true;
                }

                if (value.constructor === Number && hasAllTokens((value as Number).toString(), tokens)) {
                    return true;
                }

                if (value.constructor === Object || Array.isArray(value)) {
                    if (hasAllTokens(JSON.stringify(value), tokens)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    return array.filter(item => searchObject(item));
}