import {GenericTemplates} from "./generic.templates";
import {VoiceRecorder} from "../utility/audio/VoiceRecorder";
import {compute, create, Signal, signal} from "@targoninc/jess";

const currentLoudness = signal(0);
let recorder: VoiceRecorder;

export class AudioTemplates {
    static voiceButton(disabled: Signal<boolean>) {
        if (!recorder) {
            recorder = new VoiceRecorder(currentLoudness);
        }
        const onState = signal(false);
        const iconState = compute(o => o ? "mic" : "mic_off", onState);
        const disabledClass = compute(d => d ? "disabled" : "_", disabled);

        return create("div")
            .classes("flex", "align-children", "no-gap", disabledClass)
            .children(
                GenericTemplates.redDot(onState, currentLoudness),
                GenericTemplates.verticalButtonWithIcon(iconState, "", () => {
                    recorder.toggleRecording();
                    onState.value = !onState.value;
                }, ["voice-button"]),
            ).build();
    }
}