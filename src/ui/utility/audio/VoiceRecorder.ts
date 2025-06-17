import {toast} from "../ui";
import {activateNextUpdate, chatContext, configuration, currentText} from "../state/store.ts";
import {Signal} from "@targoninc/jess";
import {realtime} from "../../index.ts";
import {BotanikaClientEventType} from "../../../models-shared/websocket/clientEvents/botanikaClientEventType.ts";
import {NewMessageEventData} from "../../../models-shared/websocket/clientEvents/newMessageEventData.ts";
import {Api} from "../state/api.ts";

export class VoiceRecorder {
    private readonly threshold = 0.0175;
    private readonly timeout = 2000;
    private readonly mimeType = 'audio/webm; codecs=opus';
    private readonly fftSize = 1024;

    private mediaRecorder: MediaRecorder;
    private audioContext: AudioContext;
    private analyser: AnalyserNode;
    private chunkCounter = 0;
    private audioHeader: BlobPart;
    private lastDataTime: number;
    private dataInterval: number;
    private audioChunks = [];
    private currentVolume = 0;
    private sum = 0.0;
    private recording = false;
    private processing = false;
    private animationFrameId: number;
    private mediaStream: MediaStream;

    private loudness: Signal<number>;

    constructor(loudness: Signal<number>) {
        this.loudness = loudness;
        this.loudness.value = this.currentVolume;
    }

    public toggleRecording() {
        if (this.recording) {
            this.stop();
        } else {
            this.start();
        }
    }

    private start() {
        this.recording = true;
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.processMediaStream(stream);
            });
    }

    private processMediaStream(stream: MediaStream) {
        this.mediaStream = stream;
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: this.mimeType
        });
        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(stream);

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.8;

        source.connect(this.analyser);
        this.analyzeAudio();

        this.chunkCounter = 0;
        this.mediaRecorder.ondataavailable = e => {
            this.chunkCounter++;
            if (this.chunkCounter === 1) {
                this.audioHeader = e.data;
            } else {
                this.audioChunks.push(e.data);
            }
        };

        this.dataInterval = setInterval(() => {
            if (!this.recording) {
                return;
            }
            this.mediaRecorder.requestData();
        }, 1000);
        this.mediaRecorder.start();
    }

    private analyzeAudio() {
        if (!this.recording) {
            this.animationFrameId = requestAnimationFrame(this.analyzeAudio.bind(this));
            return;
        }

        const dataArray = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(dataArray);

        let sum = 0.0;
        for (let i = 0; i < dataArray.length; ++i) {
            sum += dataArray[i] * dataArray[i];
        }
        const level = Math.sqrt(sum / dataArray.length);

        this.currentVolume = level;
        this.loudness.value = this.currentVolume;

        if (level > this.threshold) {
            this.lastDataTime = Date.now();
            this.sum += level;
        } else {
            if (this.lastDataTime && Date.now() - this.lastDataTime > this.timeout && !this.processing) {
                this.sendAudio().then(() => {
                    this.sum = 0.0;
                });
            }
        }

        this.animationFrameId = requestAnimationFrame(this.analyzeAudio.bind(this));
    }

    private stop() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
        }

        if (this.dataInterval) {
            clearInterval(this.dataInterval);
            this.dataInterval = null;
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        this.recording = false;
    }

    private getAverageVolume(chunks: BlobPart[]) {
        return this.sum / chunks.length;
    }

    private async sendAudio() {
        if (this.audioChunks.length === 0) {
            return;
        }

        const averageVolume = this.getAverageVolume(this.audioChunks);
        if (averageVolume < this.threshold * 2) {
            return;
        }

        this.processing = true;
        const allAudioData = [this.audioHeader, ...this.audioChunks];
        const audioBlob = new Blob(allAudioData, {type: this.mimeType});

        const formData = new FormData();
        formData.append('file', audioBlob, "file.webm");
        console.log("Transcribing audio...");
        Api.transcribe(formData).then(async text => {
            currentText.value = currentText.value + " " + text;
            try {
                activateNextUpdate.value = true;
                const config = configuration.value;
                realtime.send({
                    type: BotanikaClientEventType.message,
                    data: <NewMessageEventData>{
                        chatId: chatContext.value.id,
                        provider: config.provider,
                        model: config.model,
                        message: currentText.value,
                    }
                });
            } catch (e) {
                toast(e.toString());
            }
            currentText.value = "";
        });

        this.audioChunks = [];
        this.processing = false;
        this.lastDataTime = null;
    }
}
