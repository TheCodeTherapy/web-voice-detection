// TypeScript code
import {
  defaultFrameProcessorOptions,
  FrameProcessor,
  FrameProcessorInterface,
  FrameProcessorOptions,
  validateOptions,
} from "./frame-processor";
import { Message } from "./messages";
import { ModelFetcher, ONNXModel, ONNXRuntimeAPI, OrtOptions } from "./models";
import { Resampler } from "./resampler";

type NonRealTimeDetectionSpeechData = {
  audio: Float32Array;
  start: number;
  end: number;
};

export type NonRealTimeDetectionOptions = FrameProcessorOptions & OrtOptions;

export const defaultNonRealTimeDetectionOptions: NonRealTimeDetectionOptions = {
  ...defaultFrameProcessorOptions,
  ortConfig: undefined,
};

export class PlatformAgnosticNonRealTimeDetection {
  frameProcessor: FrameProcessorInterface | undefined;

  static async _new(
    modelFetcher: ModelFetcher,
    ort: ONNXRuntimeAPI,
    options: NonRealTimeDetectionOptions,
  ): Promise<PlatformAgnosticNonRealTimeDetection> {
    const detection = new this(modelFetcher, ort, options);
    await detection.init();
    return detection;
  }

  constructor(
    public modelFetcher: ModelFetcher,
    public ort: ONNXRuntimeAPI,
    public options: NonRealTimeDetectionOptions,
  ) {
    validateOptions(options);
  }

  init = async () => {
    const model = await ONNXModel.new(this.ort, this.modelFetcher);

    this.frameProcessor = new FrameProcessor(model.process, model.reset_state, {
      frameSamples: this.options.frameSamples,
      positiveSpeechThreshold: this.options.positiveSpeechThreshold,
      negativeSpeechThreshold: this.options.negativeSpeechThreshold,
      redemptionFrames: this.options.redemptionFrames,
      preSpeechPadFrames: this.options.preSpeechPadFrames,
      minSpeechFrames: this.options.minSpeechFrames,
      submitUserSpeechOnPause: this.options.submitUserSpeechOnPause,
    });
    this.frameProcessor.resume();
  };

  run = async function* (
    this: PlatformAgnosticNonRealTimeDetection,
    inputAudio: Float32Array,
    sampleRate: number,
  ): AsyncGenerator<NonRealTimeDetectionSpeechData> {
    const resamplerOptions = {
      nativeSampleRate: sampleRate,
      targetSampleRate: 16000,
      targetFrameSize: this.options.frameSamples,
    };
    const resampler = new Resampler(resamplerOptions);
    let start = 0;
    let end = 0;
    let frameIndex = 0;

    for await (const frame of resampler.stream(inputAudio)) {
      const { msg, audio } = await this.frameProcessor!.process(frame);
      switch (msg) {
        case Message.SpeechStart:
          start = (frameIndex * this.options.frameSamples) / 16;
          break;

        case Message.SpeechEnd:
          end = ((frameIndex + 1) * this.options.frameSamples) / 16;
          if (audio) {
            yield { audio, start, end };
          }
          break;

        default:
          break;
      }
      frameIndex++;
    }

    const { msg, audio } = this.frameProcessor!.endSegment();
    if (msg === Message.SpeechEnd) {
      if (audio) {
        yield {
          audio,
          start,
          end: (frameIndex * this.options.frameSamples) / 16,
        };
      }
    }
  };
}
