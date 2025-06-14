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