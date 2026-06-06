import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import CloudinaryService from '../../../../../shared/services/cloudinary-service';

export interface F5TTSConfig {
    referenceAudioPath?: string;
    referenceText?: string;
    pythonBin?: string;
}

class F5TTSService {
    private cloudinaryService: CloudinaryService;
    private referenceAudioPath: string;
    private referenceText: string;
    private pythonBin: string;

    constructor(config?: F5TTSConfig) {
        this.cloudinaryService = CloudinaryService.getInstance();
        this.referenceAudioPath = this.resolveReferenceAudioPath(
            config?.referenceAudioPath || process.env.F5_REFERENCE_AUDIO_PATH
        );
        this.referenceText =
            config?.referenceText ||
            process.env.F5_REFERENCE_TEXT ||
            `Have you ever wondered why some websites load instantaneously while others take several seconds? At first glance, both applications may look identical. But behind the scenes, the architecture can be completely different. A few small engineering decisions can have a massive impact on performance, scalability, and reliability.
            Most developers use databases, caches, APIs, and message queues every day. But very few stop to think about what actually happens after a request leaves the browser. That's exactly what we're going to explore.
            
            This sounds impossible, but it's true. A cache can sometimes make your application slower. A distributed database can return old data even when everything appears healthy. And a single configuration mistake can bring down an entire service.
            The interesting part isn't that these things happen. The interesting part is why they happen.
            
            Let's break this down step by step. Imagine a request arrives at your server. The server checks the cache first because accessing memory is much faster than querying a database. If the data exists, the response is returned immediately. If it doesn't, the application has to perform additional work before sending a response back to the user.
            This process happens thousands of times every second in modern systems.
            
            Here's the important part.
            Speed is only one piece of the puzzle.
            A system can be fast and still fail.
            A system can be reliable and still become expensive.
            And a system can scale beautifully right up until the moment it doesn't.
            
            Sounds simple, right?
            Not quite.
            There's one detail most people miss.
            And that's where things start to get interesting.
            Because once you understand this concept, a lot of engineering decisions suddenly make much more sense.
            
            Now watch what happens next.
            Traffic suddenly doubles.
            The cache starts missing.
            Database queries increase.
            Latency begins to rise.
            And within a few seconds, a system that looked perfectly healthy starts behaving very differently.`;
        this.pythonBin =
            config?.pythonBin ||
            process.env.F5_PYTHON_BIN ||
            process.env.PYTHON_BIN ||
            'python3';
    }

    private resolveReferenceAudioPath(envPath?: string): string {
        if (envPath) {
            return path.isAbsolute(envPath)
                ? envPath
                : path.resolve(process.cwd(), envPath);
        }

        return path.resolve(
            __dirname,
            '..',
            '..',
            'assests',
            'better-reference-audio.wav'
        );
    }

    private async runPythonTts(text: string, outputPath: string): Promise<void> {
        const outputDir = path.dirname(outputPath);
        await fs.promises.mkdir(outputDir, { recursive: true });

        const scriptPath = path.join(
            outputDir,
            `f5_tts_${Date.now()}_${Math.random().toString(36).slice(2)}.py`
        );

        const pythonCode = `import soundfile as sf\n` +
            `from f5_tts.api import F5TTS\n\n` +
            `REFERENCE_AUDIO = ${JSON.stringify(this.referenceAudioPath)}\n` +
            `REFERENCE_TEXT = ${JSON.stringify(this.referenceText)}\n` +
            `GENERATE_TEXT = ${JSON.stringify(text)}\n` +
            `OUTPUT_FILE = ${JSON.stringify(outputPath)}\n\n` +
            `tts = F5TTS()\n` +
            `wav, sr, _ = tts.infer(\n` +
            `    ref_file=REFERENCE_AUDIO,\n` +
            `    ref_text=REFERENCE_TEXT,\n` +
            `    gen_text=GENERATE_TEXT,\n` +
            `)\n` +
            `sf.write(OUTPUT_FILE, wav, sr)\n`;

        await fs.promises.writeFile(scriptPath, pythonCode, 'utf8');

        try {
            await this.runPythonScript(scriptPath);
        } finally {
            await fs.promises.rm(scriptPath, { force: true });
        }

        if (!fs.existsSync(outputPath)) {
            throw new Error(`F5 TTS did not produce output file: ${outputPath}`);
        }
    }

    private async runPythonBatch(
        tasks: Array<{ text: string; outputPath: string }>,
        outputDir: string
    ): Promise<void> {
        if (tasks.length === 0) {
            return;
        }

        await fs.promises.mkdir(outputDir, { recursive: true });

        const scriptPath = path.join(
            outputDir,
            `f5_tts_batch_${Date.now()}_${Math.random().toString(36).slice(2)}.py`
        );
        const tasksPath = path.join(
            outputDir,
            `f5_tts_tasks_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
        );

        const pythonCode =
            `import json\n` +
            `import time\n` +
            `import traceback\n` +
            `import soundfile as sf\n` +
            `from f5_tts.api import F5TTS\n\n` +

            `REFERENCE_AUDIO = ${JSON.stringify(this.referenceAudioPath)}\n` +
            `REFERENCE_TEXT = ${JSON.stringify(this.referenceText)}\n` +
            `TASKS_PATH = ${JSON.stringify(tasksPath)}\n\n` +

            `print("[F5] Script started", flush=True)\n` +

            `with open(TASKS_PATH, 'r', encoding='utf-8') as f:\n` +
            `    tasks = json.load(f)\n\n` +

            `print(f"[F5] Loaded {len(tasks)} tasks", flush=True)\n` +

            `for idx, task in enumerate(tasks, start=1):\n` +
            `    text = task['text']\n` +
            `    print(\n` +
            `        f"[F5] Task {idx}: chars={len(text)} words={len(text.split())}",\n` +
            `        flush=True\n` +
            `    )\n` +

            `print("[F5] Starting model load...", flush=True)\n` +
            `model_load_start = time.time()\n` +

            `tts = F5TTS()\n\n` +

            `print(\n` +
            `    f"[F5] Model loaded in {time.time() - model_load_start:.2f}s",\n` +
            `    flush=True\n` +
            `)\n\n` +

            `for idx, task in enumerate(tasks, start=1):\n` +
            `    text = task['text']\n` +
            `    output_path = task['outputPath']\n\n` +

            `    print(\n` +
            `        f"[F5] Starting inference {idx}/{len(tasks)}",\n` +
            `        flush=True\n` +
            `    )\n` +

            `    inference_start = time.time()\n\n` +

            `    try:\n` +
            `        wav, sr, _ = tts.infer(\n` +
            `            ref_file=REFERENCE_AUDIO,\n` +
            `            ref_text=REFERENCE_TEXT,\n` +
            `            gen_text=text,\n` +
            `        )\n\n` +

            `        inference_time = time.time() - inference_start\n\n` +

            `        print(\n` +
            `            f"[F5] Inference {idx} completed in {inference_time:.2f}s",\n` +
            `            flush=True\n` +
            `        )\n\n` +

            `        sf.write(output_path, wav, sr)\n\n` +

            `        print(\n` +
            `            f"[F5] Wrote {idx}/{len(tasks)}: {output_path}",\n` +
            `            flush=True\n` +
            `        )\n` +

            `    except Exception as e:\n` +
            `        print(\n` +
            `            f"[F5] ERROR during task {idx}: {str(e)}",\n` +
            `            flush=True\n` +
            `        )\n` +
            `        traceback.print_exc()\n` +
            `        raise\n`;

        await fs.promises.writeFile(scriptPath, pythonCode, 'utf8');
        await fs.promises.writeFile(tasksPath, JSON.stringify(tasks), 'utf8');

        try {
            await this.runPythonScript(scriptPath);
        } finally {
            await fs.promises.rm(scriptPath, { force: true });
            await fs.promises.rm(tasksPath, { force: true });
        }

        for (const task of tasks) {
            if (!fs.existsSync(task.outputPath)) {
                throw new Error(`F5 TTS did not produce output file: ${task.outputPath}`);
            }
        }
    }

    private runPythonScript(scriptPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.pythonBin, [scriptPath], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stderr = '';
            let stdout = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('error', (error) => {
                reject(error);
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    if (stdout.trim()) {
                        console.error(stdout.trim());
                    }
                    resolve();
                } else {
                    reject(
                        new Error(
                            `F5 TTS python process failed (code ${code}). ${stderr.trim()}`
                        )
                    );
                }
            });
        });
    }

    private addWavHeader(audioData: Buffer, sampleRate: number = 24000): Buffer {
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = audioData.length;

        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitsPerSample, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40);

        return Buffer.concat([header, audioData]);
    }

    private async createSilenceAudio(outputPath: string, durationSeconds: number): Promise<string> {
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const numSamples = Math.floor(sampleRate * durationSeconds);
        const dataSize = numSamples * numChannels * bytesPerSample;
        const silentData = Buffer.alloc(dataSize, 0);

        const wavBuffer = this.addWavHeader(silentData, sampleRate);
        const dir = path.dirname(outputPath);
        await fs.promises.mkdir(dir, { recursive: true });
        const wavPath = outputPath.replace(/\.\w+$/, '.wav');
        await fs.promises.writeFile(wavPath, wavBuffer);

        console.error(`💾 Silent audio created: ${wavPath} (${durationSeconds}s)`);
        return wavPath;
    }

    async generateNarrationAudios(
        jobId: string,
        narrations: string[],
        outputDir: string
    ): Promise<string[]> {
        const audioUrls: string[] = [];

        const batchTasks: Array<{ text: string; outputPath: string; index: number }> = [];

        for (let i = 0; i < narrations.length; i++) {
            const narration = narrations[i];
            const outputPath = path.join(outputDir, `narration-part-${i + 1}.wav`);

            if (!narration || narration.trim() === '') {
                console.error(`🔇 Empty narration detected - creating 1 second silence`);
                const silentPath = await this.createSilenceAudio(outputPath, 1.0);
                batchTasks.push({ text: '', outputPath: silentPath, index: i });
            } else {
                batchTasks.push({ text: narration, outputPath, index: i });
            }
        }

        const nonEmptyTasks = batchTasks.filter((task) => task.text.trim() !== '');
        if (nonEmptyTasks.length > 0) {
            console.error(`Generating ${nonEmptyTasks.length} narration parts in a single F5 batch...`);
            await this.runPythonBatch(
                nonEmptyTasks.map(({ text, outputPath }) => ({ text, outputPath })),
                outputDir
            );
        }

        for (let i = 0; i < batchTasks.length; i++) {
            const task = batchTasks[i];
            const audioPath = task.outputPath;
            try {
                console.error(`Uploading narration part ${task.index + 1} to Cloudinary...`);
                const upload = await this.cloudinaryService.uploadAudio(
                    audioPath,
                    `narrations/${jobId}`,
                    `part-${task.index + 1}`
                );
                console.error(`✅ Narration part ${task.index + 1} uploaded: ${upload.secureUrl}`);
                audioUrls[task.index] = upload.secureUrl;
                await fs.promises.rm(audioPath, { force: true });
            } catch (error) {
                console.error(`❌ Failed to upload narration part ${task.index + 1} (F5):`, error);
                throw error;
            }
        }

        return audioUrls;
    }
}

export default F5TTSService;