import {Signal} from "@targoninc/jess";

export function closeIfNotClickedInsideClass(className: string, visible: Signal<boolean>) {
    const handleClick = (event: MouseEvent) => {
        const target = event.target as Element;

        if (!target.closest(`.${className}`)) {
            visible.value = false;
            document.removeEventListener('click', handleClick);
        }
    };

    document.addEventListener('click', handleClick);
}