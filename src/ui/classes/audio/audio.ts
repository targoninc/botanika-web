import {currentlyPlayingAudio} from "../state/store.ts";
import {ApiBase} from "../state/api.base.ts";

let audio;

export async function playAudio(file: string) {
    if (currentlyPlayingAudio.value) {
        return;
    }
    if (!audio) {
        audio = new Audio();
    }
    currentlyPlayingAudio.value = file;
    const src = `${ApiBase.baseUrl}/audio?file=${file}`;
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