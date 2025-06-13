import {AnyNode, create, Signal, signalMap} from "@targoninc/jess";
import {MessageFile} from "../../models/chat/MessageFile.ts";
import {GenericTemplates} from "./generic.templates.ts";
import {icon} from "@targoninc/jess-components";
import {downloadFile} from "../classes/attachFiles.ts";

export class FileTemplates {
    static filesDisplay(files: Signal<MessageFile[]>) {
        return create("div")
            .children(
                signalMap(files, create("div").classes("flex"), f => FileTemplates.fileDisplay(files, f))
            ).build();
    }

    private static fileDisplay(files: Signal<MessageFile[]>, file: MessageFile) {
        let {content, width} = FileTemplates.fileDisplayContent(file);

        return create("div")
            .classes("file-display", "relative")
            .styles("min-width", width, "max-width", width)
            .children(
                content,
                create("div")
                    .classes("file-actions")
                    .children(
                        GenericTemplates.buttonWithIcon("close", "", () => files.value = files.value.filter(f => f.id !== file.id)),
                    ).build()
            ).build();
    }

    public static fileDisplayContent(file: MessageFile) {
        let content: AnyNode;
        let width = "10em";
        if (file.mimeType.startsWith("image/")) {
            width = "5em";
            content = GenericTemplates.messageImage(file);
        } else if (file.mimeType.startsWith("audio/")) {
            content = FileTemplates.audioDisplay(file);
        } else if (file.mimeType === "application/pdf") {
            content = FileTemplates.fillButton("open_in_new", file.name, () => {
                window.open(`data:${file.mimeType};base64,` + file.base64, "_blank");
            });
        } else {
            content = FileTemplates.fillButton("open_in_new", file.name, () => downloadFile(file));
        }
        return {content, width};
    }

    private static audioDisplay(file: MessageFile) {
        return create("audio")
            .attributes("controls", "")
            .classes("file-display-audio")
            .src(`data:${file.mimeType};base64,` + file.base64)
            .build();
    }

    static fillButton(iconStr: string, text: string, onclick: () => void) {
        return create("button")
            .classes("full-width", "full-height", "flex", "clickable", "align-children", "center-content", "padded-big", "attachment")
            .onclick(onclick)
            .children(
                create("div")
                    .classes("flex-v", "small-gap")
                    .children(
                        icon({
                            icon: iconStr,
                        }),
                        create("span")
                            .classes("text-small")
                            .text(text)
                            .build()
                    ).build()
            ).build();
    }
}