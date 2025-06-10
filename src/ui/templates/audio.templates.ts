import {GenericTemplates} from "./generic.templates";
import {VoiceRecorder} from "../classes/audio/VoiceRecorder";
import {compute, create, signal} from "@targoninc/jess";

const currentLoudness = signal(0);
let recorder: VoiceRecorder;

export class AudioTemplates {
    static voiceButton() {
        if (!recorder) {
            recorder = new VoiceRecorder(currentLoudness);
        }
        const onState = signal(false);
        const iconState = compute(o => o ? "mic" : "mic_off", onState);

        return create("div")
            .classes("flex", "align-children", "no-gap")
            .children(
                GenericTemplates.redDot(onState, currentLoudness),
                GenericTemplates.verticalButtonWithIcon(iconState, "", () => {
                    recorder.toggleRecording();
                    onState.value = !onState.value;
                }, ["voice-button"]),
            ).build();
    }
}