import {Signal} from "@targoninc/jess";
import {MessageFile} from "../../models/chat/MessageFile.ts";
import {v4 as uuidv4} from "uuid";

export function handleDroppedFiles(e: DragEvent, files: Signal<MessageFile[]>) {
    // Prevent default behavior to allow drop
    e.preventDefault();
    
    if (!e.dataTransfer?.files.length) return;
    
    const droppedFiles = e.dataTransfer.files;
    const messageFiles: MessageFile[] = [];
    
    // Process each dropped file
    Array.from(droppedFiles).forEach(file => {
        // Check if the file is an image or PDF
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            // Read file as base64
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result as string;
                // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64 = base64String.split(',')[1];
                
                // Create a new MessageFile
                const messageFile = {
                    id: uuidv4(),
                    name: file.name,
                    base64,
                    mimeType: file.type
                };
                
                // Update the files signal with the new file
                files.value = [...files.value, messageFile];
            };
            reader.readAsDataURL(file);
        }
    });
}