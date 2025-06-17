import {currentlyPlayingAudio} from "../state/store.ts";
import {ApiEndpoint} from "../../../models-shared/ApiEndpoints.ts";

let audio;

export async function playAudio(id: string) {
    if (currentlyPlayingAudio.value) {
        return;
    }
    if (!audio) {
        audio = new Audio();
    }
    currentlyPlayingAudio.value = id;
    const src = `${ApiEndpoint.AUDIO}?id=${id}`;
    console.log(`Playing audio: ${src}`);
    audio.src = src;
    audio.onended = () => {
        currentlyPlayingAudio.value = null;
    };
    audio.currentTime = 0;
    await audio.play();
}

export function stopAudio() {
    if (audio.paused) {
        return;
    }
    audio.pause();
    currentlyPlayingAudio.value = null;
}