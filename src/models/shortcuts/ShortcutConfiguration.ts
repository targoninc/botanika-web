import {Shortcut} from "./Shortcut";

export type ShortcutConfiguration = Record<Shortcut, ShortcutConfig>;
export type ShortcutConfig = {
    key: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
}
