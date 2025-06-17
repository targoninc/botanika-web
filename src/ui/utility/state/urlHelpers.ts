export function getUrlParameter(param: string, fallback: any) {
    const url = new URL(window.location.href);
    return url.searchParams.get(param) ?? fallback;
}

export function getPathname() {
    const path = new URL(window.location.href).pathname.split("/").at(-1);
    return path === "" ? null : path;
}

export function getHost(input: string) {
    const url = new URL(input);
    return url.origin;
}

export function updateUrlParameter(param: string, value: string | null) {
    const url = new URL(window.location.href);
    if (value) {
        url.searchParams.set(param, value);
    } else {
        url.searchParams.delete(param);
    }
    history.pushState({}, "", url);
    return url;
}

export function updateUrlPathname(pathname: string) {
    const url = new URL(window.location.href);
    url.pathname = pathname;
    history.pushState({}, "", url);
    return url;
}
