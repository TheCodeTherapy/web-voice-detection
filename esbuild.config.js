const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const esbuild = require("esbuild");
const outDir = path.join(__dirname, "dist");
const wasmOutDir = outDir;
const wasmSrcDir = path.join(__dirname, "assets");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const copyWasmFiles = () => {
  if (!fs.existsSync(wasmOutDir)) {
    fs.mkdirSync(wasmOutDir, { recursive: true });
  }

  fs.readdirSync(wasmSrcDir).forEach((file) => {
    fs.copyFileSync(path.join(wasmSrcDir, file), path.join(wasmOutDir, file));
  });
};

fs.copyFileSync(path.join(__dirname, "assets", "model.onnx"), path.join(outDir, "model.onnx"));

// First, run the TypeScript compiler to generate .d.ts files
exec("tsc --emitDeclarationOnly --outDir ./dist", (error, stdout, stderr) => {
  if (error) {
    console.error(`tsc error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`tsc stderr: ${stderr}`);
    return;
  }

  // Then, run esbuild to bundle the JavaScript code
  esbuild
    .build({
      entryPoints: ["./src/index.ts", "./src/worklet.ts"],
      bundle: true,
      outdir: outDir,
      sourcemap: true,
      format: "esm",
      target: "es2020",
      minify: true,
    })
    .then(() => {
      console.log("Build completed successfully!");
      copyWasmFiles();
    })
    .catch(() => process.exit(1));
});
