/* eslint-disable @typescript-eslint/no-unused-vars */
import { log, Message, Resampler } from "./common";

type WorkletOptions = {
  frameSamples: number;
};

type AudioWorkletProcessor = {
  readonly port: MessagePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
};

declare let AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

type AudioParamDescriptor = {
  name: string;
  automationRate: "a-rate" | "k-rate";
  minValue: number;
  maxValue: number;
  defaultValue: number;
};

declare function registerProcessor(
  name: string,
  processorCtor: (new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor) & {
    parameterDescriptors?: AudioParamDescriptor[];
  },
): undefined;

class Processor extends AudioWorkletProcessor {
  resampler!: Resampler;
  _initialized = false;
  _stopProcessing = false;
  options: WorkletOptions;

  port!: MessagePort;

  constructor(options: { processorOptions: WorkletOptions }) {
    super();
    this.options = options.processorOptions as WorkletOptions;

    this.port.onmessage = (ev) => {
      if (ev.data.message === Message.SpeechStop) {
        this._stopProcessing = true;
      }
    };

    this.init();
  }
  init = () => {
    log.debug("initializing worklet");
    this.resampler = new Resampler({
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      nativeSampleRate: sampleRate,
      targetSampleRate: 16000,
      targetFrameSize: this.options.frameSamples,
    });
    this._initialized = true;
    log.debug("initialized worklet");
  };
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    if (this._stopProcessing) {
      return false;
    }

    const arr = inputs[0][0];

    if (this._initialized && arr instanceof Float32Array) {
      const frames = this.resampler.process(arr);
      for (const frame of frames) {
        this.port.postMessage({ message: Message.AudioFrame, data: frame.buffer }, [frame.buffer]);
      }
    }

    return true;
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
registerProcessor("voice-worklet", Processor);
