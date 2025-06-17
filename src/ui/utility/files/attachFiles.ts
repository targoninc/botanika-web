import {create, Signal} from "@targoninc/jess";
import {MessageFile} from "../../../models-shared/chat/MessageFile.ts";
import {getExtension, getMimeType} from "./FileMimeType.ts";

export function attachFiles(files: Signal<MessageFile[]>) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;

    fileInput.onchange = async (event) => {
        const selectedFiles = (event.target as HTMLInputElement).files;
        if (!selectedFiles) return;

        const messageFiles: MessageFile[] = [];

        for (const file of selectedFiles) {
            addFileToArray(file, true, files);
        }

        files.value = [...files.value, ...messageFiles];
        fileInput.value = '';
    };

    fileInput.click();
}

export function addFileToArray(file: File, added: boolean, files: Signal<MessageFile[]>) {
    const reader = new FileReader();
    reader.onload = () => {
        const base64String = reader.result as string;
        const base64 = base64String.split(',')[1];

        let type = file.type;
        if (type === "") {
            type = getMimeType(file.name);
        }

        const messageFile = {
            id: crypto.randomUUID(),
            name: file.name,
            base64,
            mimeType: type
        };

        added = true;
        files.value = [...files.value, messageFile];
    };
    reader.readAsDataURL(file);
    return added;
}

export function handleDroppedFiles(e: DragEvent, files: Signal<MessageFile[]>) {
    if (!e.dataTransfer?.files.length) {
        return;
    }

    const droppedFiles = e.dataTransfer.files;

    let added = false;
    Array.from(droppedFiles).forEach(file => {
        added = addFileToArray(file, added, files);
    });
    e.preventDefault();
}

export function pasteFile(e: ClipboardEvent, files: Signal<MessageFile[]>) {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) {
        return;
    }

    let added = false;
    for (const item of items) {
        const file = item.getAsFile();
        if (!file) continue;

        added = addFileToArray(file, added, files);
    }

    if (added) {
        e.preventDefault();
    }
}

export function downloadFile(f: MessageFile) {
    const a = document.createElement("a");
    a.href = f.base64;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
}