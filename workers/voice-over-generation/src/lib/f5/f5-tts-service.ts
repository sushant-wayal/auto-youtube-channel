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
            'Most distributed systems fail silently before they fail visibly. A retry loop without backoff can destroy a production service.';
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
            'reference-audio.mp3'
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

        for (let i = 0; i < narrations.length; i++) {
            console.error(`Generating narration part ${i + 1} of ${narrations.length} (F5)...`);
            const narration = narrations[i];
            const outputPath = path.join(outputDir, `narration-part-${i + 1}.wav`);

            try {
                let audioPath: string;

                if (!narration || narration.trim() === '') {
                    console.error(`🔇 Empty narration detected - creating 1 second silence`);
                    audioPath = await this.createSilenceAudio(outputPath, 1.0);
                } else {
                    await this.runPythonTts(narration, outputPath);
                    audioPath = outputPath;
                }

                console.error(`Uploading narration part ${i + 1} to Cloudinary...`);

                const upload = await this.cloudinaryService.uploadAudio(
                    audioPath,
                    `narrations/${jobId}`,
                    `part-${i + 1}`
                );

                console.error(`✅ Narration part ${i + 1} uploaded: ${upload.secureUrl}`);
                audioUrls.push(upload.secureUrl);

                await fs.promises.rm(audioPath, { force: true });
            } catch (error) {
                console.error(`❌ Failed to generate narration part ${i + 1} (F5):`, error);
                throw error;
            }
        }

        return audioUrls;
    }
}

export default F5TTSService;