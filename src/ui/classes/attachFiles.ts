import {Signal} from "@targoninc/jess";
import {MessageFile} from "../../models/chat/MessageFile.ts";

export function attachFiles(files: Signal<MessageFile[]>) {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;

    // Handle file selection
    fileInput.onchange = async (event) => {
        const selectedFiles = (event.target as HTMLInputElement).files;
        if (!selectedFiles) return;

        const messageFiles: MessageFile[] = [];

        for (const file of selectedFiles) {
            // Read file as base64
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64String = reader.result as string;
                    // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                    resolve(base64String.split(',')[1]);
                };
                reader.readAsDataURL(file);
            });

            messageFiles.push({
                base64,
                mimeType: file.type
            });
        }

        // Update the files signal with the new files
        files.value = [...files.value, ...messageFiles];

        // Clear the input value so the same file can be selected again
        fileInput.value = '';
    };

    // Trigger file selection dialog
    fileInput.click();
}