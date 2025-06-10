import {Signal} from "@targoninc/jess";
import {MessageFile} from "../../models/chat/MessageFile.ts";

export function pasteFile(e: ClipboardEvent, files: Signal<MessageFile[]>) {
    // Check if there are any supported file items in the clipboard
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) {
        return;
    }

    let added = false;
    for (const item of items) {
        const file = item.getAsFile();
        if (!file) continue;

        // Read file as base64
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64 = base64String.split(',')[1];

            // Create a new MessageFile
            const messageFile = {
                id: crypto.randomUUID(),
                name: file.name,
                base64,
                mimeType: file.type
            };

            // Update the files signal with the new file
            added = true;
            files.value = [...files.value, messageFile];
        };
        reader.readAsDataURL(file);
    }

    if (added) {
        e.preventDefault();
    }
}
