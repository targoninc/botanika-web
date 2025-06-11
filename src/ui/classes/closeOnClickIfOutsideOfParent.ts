import {Signal} from "@targoninc/jess";
import {target} from "./state/store.ts";

export function closeOnClickIfOutsideOfParent(className: string, visible: Signal<boolean>) {
    function anyParentOrSelfContainsClass(htmlInputElement: HTMLElement, className: string) {
        if (!htmlInputElement) {
            return false;
        }

        return htmlInputElement.classList.contains(className) || anyParentOrSelfContainsClass(htmlInputElement.parentElement, className);
    }

    setTimeout(() => {
        document.addEventListener("click", (e) => {
            if (anyParentOrSelfContainsClass(target(e), className)) {
                closeOnClickIfOutsideOfParent(className, visible);
            } else {
                visible.value = false;
            }
        }, {once: true});
    });
}