import {GenericTemplates} from "./generic.templates";
import {VoiceRecorder} from "../utility/audio/VoiceRecorder";
import {compute, create, Signal, signal, when} from "@targoninc/jess";
import {transcribing} from "../utility/state/store.ts";

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
                when(transcribing, GenericTemplates.redDot(onState, currentLoudness), true),
                when(transcribing, GenericTemplates.spinner()),
                GenericTemplates.verticalButtonWithIcon(iconState, "", () => {
                    recorder.toggleRecording(disabled);
                    onState.value = !onState.value;
                }, ["voice-button"]),
            ).build();
    }
}