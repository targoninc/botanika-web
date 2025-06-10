import {Signal} from "@targoninc/jess";
import {MessageFile} from "../../models/chat/MessageFile.ts";

export function pasteFile(e: ClipboardEvent, files: Signal<MessageFile[]>) {
    // Check if there are any image items in the clipboard
    const items = e.clipboardData?.items;
    if (!items) return;

    let hasImageItem = false;

    for (const item of items) {
        // Check if the item is an image
        if (item.type.startsWith('image/')) {
            hasImageItem = true;
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
                    base64,
                    mimeType: file.type
                };

                // Update the files signal with the new file
                files.value = [...files.value, messageFile];
            };
            reader.readAsDataURL(file);
        }
    }

    // If we found and processed an image, prevent the default paste behavior
    if (hasImageItem) {
        e.preventDefault();
    }
}