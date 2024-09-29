export async function audioFileToArray(audioFileData: Blob) {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const reader = new FileReader();
  let audioBuffer: AudioBuffer | null = null;
  await new Promise<void>((res) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reader.addEventListener("loadend", (_ev: ProgressEvent<FileReader>) => {
      const audioData = reader.result as ArrayBuffer;
      ctx.decodeAudioData(
        audioData,
        (buffer) => {
          audioBuffer = buffer;
          ctx
            .startRendering()
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .then((_renderedBuffer: AudioBuffer) => {
              console.log("Rendering completed successfully");
              res();
            })
            .catch((err) => {
              console.error(`Rendering failed: ${err}`);
            });
        },
        (e) => {
          console.log(`Error with decoding audio data: ${e}`);
        },
      );
    });
    reader.readAsArrayBuffer(audioFileData);
  });
  if (audioBuffer === null) {
    throw Error("some shit");
  }
  const _audioBuffer = audioBuffer as AudioBuffer;
  const out = new Float32Array(_audioBuffer.length);
  for (let i = 0; i < _audioBuffer.length; i++) {
    for (let j = 0; j < _audioBuffer.numberOfChannels; j++) {
      out[i] += _audioBuffer.getChannelData(j)[i];
    }
  }
  return { audio: out, sampleRate: _audioBuffer.sampleRate };
}
