/**
 * Gemini TTS Service
 * Uses Google's Gemini 2.5 Flash Preview TTS model for high-quality voice generation
 * Handles long-form narration (5-10 minutes) in a single request
 */

import GeminiClient from "./gemini-client";
import type { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import CloudinaryService from '../../../../../shared/services/cloudinary-service';

export interface GeminiTTSConfig {
    voice?: string; // Voice selection (Puck, Charon, Kore, Fenrir, Aoede)
    speed?: number; // Speed multiplier (0.25 to 4.0)
}

class GeminiTTSService {
    private geminiClient: GeminiClient;
    private readonly MODEL_NAME = "gemini-2.5-flash-preview-tts"; // Correct TTS model name
    private cloudinaryService: CloudinaryService;

    // Available voices for Gemini TTS
    private readonly VOICES = {
        PUCK: "Puck",      // Friendly, warm voice
        CHARON: "Charon",  // Deep, authoritative voice
        KORE: "Kore",      // Clear, professional voice
        FENRIR: "Fenrir",  // Strong, confident voice
        AOEDE: "Aoede",    // Soft, pleasant voice
    };

    constructor() {
        this.geminiClient = GeminiClient.getInstance();
        this.cloudinaryService = CloudinaryService.getInstance();
    }

    /**
     * Generate speech from text using Gemini 2.5 Flash Preview TTS
     * Includes exponential backoff for transient 5xx / overload errors
     */
    async generateSpeech(
        text: string,
        config?: GeminiTTSConfig
    ): Promise<Buffer> {
        const MAX_RETRIES = 5;
        const BASE_DELAY_MS = 2_000; // 2s
        const MAX_DELAY_MS = 30_000;

        console.error(`\n🎙️ === GEMINI TTS GENERATION STARTED ===`);
        console.error(`📝 Text length: ${text.length} characters`);
        console.error(`🎤 Voice: ${config?.voice || this.VOICES.PUCK}`);
        console.error(`⚡ Speed: ${config?.speed || 1.0}x`);

        const processedText = this.processNarrationForTTS(text);

        const speechConfig: any = {};
        if (config?.voice) {
            speechConfig.voiceConfig = {
                prebuiltVoiceConfig: { voiceName: config.voice },
            };
        }
        if (config?.speed) {
            speechConfig.speed = config.speed;
        }

        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            attempt++;

            try {
                console.error(
                    `🚀 Gemini TTS request (attempt ${attempt}/${MAX_RETRIES})`
                );

                const result = await this.geminiClient.getGenAI().models.generateContent({
                    model: this.MODEL_NAME,
                    contents: processedText,
                    config: {
                        temperature: 0,
                        maxOutputTokens: 32000,
                        responseModalities: ["AUDIO"],
                        speechConfig:
                            Object.keys(speechConfig).length > 0 ? speechConfig : undefined,
                    },
                });

                if (!result.candidates || result.candidates.length === 0) {
                    throw new Error("No audio generated in response");
                }

                const candidate = result.candidates[0];
                console.error(`Finish Reason: ${candidate.finishReason}`);

                const audioPart = candidate.content?.parts?.find(
                    (p: any) => p.inlineData
                );

                if (!audioPart?.inlineData?.data) {
                    throw new Error("No audio data found in response");
                }

                const audioBuffer = Buffer.from(
                    audioPart.inlineData.data,
                    "base64"
                );

                console.error(`✅ Generated ${audioBuffer.length} bytes of audio`);
                console.error(
                    `🎵 Audio format: ${audioPart.inlineData.mimeType || "audio/wav"}`
                );
                console.error(`✅ === GEMINI TTS GENERATION COMPLETE ===\n`);

                return audioBuffer;
            } catch (error: any) {
                const apiError =
                    error?.error ||
                    error?.response?.error ||
                    error?.cause?.error;

                const statusCode =
                    apiError?.code ||
                    apiError?.status ||
                    error?.status ||
                    error?.code;

                if (!statusCode) console.error(`Failed to get status code from error:`, error);

                const message =
                    (error?.message?.toLowerCase?.() || "") +
                    " " +
                    (error?.cause?.message?.toLowerCase?.() || "");

                if (!message.trim()) console.error(`Failed to get message from error:`, error);

                const isRetryable =
                    statusCode === 429 ||
                    statusCode === 500 ||
                    statusCode === 503 ||
                    message.includes("internal") ||
                    message.includes("overloaded") ||
                    message.includes("unavailable") ||
                    message.includes("fetch failed") ||
                    message.includes("network") ||
                    message.includes("econnreset") ||
                    message.includes("econnrefused") ||
                    message.includes("etimedout") ||
                    message.includes("socket hang up") ||
                    message.includes("typeerror");

                if (!isRetryable || attempt >= MAX_RETRIES) {
                    console.error(`❌ Gemini TTS failed permanently:`, error);
                    throw new Error(
                        `Failed to generate speech with Gemini TTS: ${error.message || error}`
                    );
                }

                const delay =
                    Math.min(
                        BASE_DELAY_MS * 2 ** (attempt - 1),
                        MAX_DELAY_MS
                    ) +
                    Math.floor(Math.random() * 1_000); // jitter

                console.warn(
                    `⚠️ Gemini TTS error (retryable). Waiting ${delay}ms before retry...`
                );

                await new Promise((res) => setTimeout(res, delay));
            }
        }

        throw new Error("Gemini TTS failed after maximum retries");
    }

    /**
     * Generate speech and save to file
     * @param text - The text to convert to speech
     * @param outputPath - Path where the audio file will be saved
     * @param config - Optional TTS configuration
     * @returns The path to the saved file
     */
    async generateSpeechToFile(
        text: string,
        outputPath: string,
        config?: GeminiTTSConfig
    ): Promise<string> {
        try {
            const audioBuffer = await this.generateSpeech(text, config);

            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Gemini TTS returns raw PCM audio data without WAV headers
            // We need to add proper WAV headers for browser playback
            const wavBuffer = this.addWavHeader(audioBuffer);

            // Write to file
            const wavPath = outputPath.replace(/\.\w+$/, '.wav');
            fs.writeFileSync(wavPath, wavBuffer);

            console.error(`💾 Audio saved to: ${wavPath}`);
            console.error(`📊 File size: ${(wavBuffer.length / 1024 / 1024).toFixed(2)} MB`);

            return wavPath;

        } catch (error) {
            console.error("❌ Error saving speech to file:", error);
            throw new Error(`Failed to save speech to file: ${error}`);
        }
    }

    /**
     * Add WAV header to raw PCM audio data
     * Gemini TTS returns raw audio, so we need to wrap it in WAV format
     */
    private addWavHeader(audioData: Buffer): Buffer {
        // WAV file format specifications
        // Assuming 24kHz sample rate, 16-bit, mono (Gemini TTS default)
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = audioData.length;

        // Create WAV header (44 bytes)
        const header = Buffer.alloc(44);

        // RIFF chunk descriptor
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + dataSize, 4); // File size - 8
        header.write('WAVE', 8);

        // fmt sub-chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
        header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
        header.writeUInt16LE(numChannels, 22); // NumChannels
        header.writeUInt32LE(sampleRate, 24); // SampleRate
        header.writeUInt32LE(byteRate, 28); // ByteRate
        header.writeUInt16LE(blockAlign, 32); // BlockAlign
        header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample

        // data sub-chunk
        header.write('data', 36);
        header.writeUInt32LE(dataSize, 40); // Subchunk2Size

        // Combine header and audio data
        return Buffer.concat([header, audioData]);
    }

    /**
     * Process narration text for better TTS output
     */
    processNarrationForTTS(narration: string): string {
        // Remove extra whitespace
        let processed = narration.replace(/\s+/g, " ").trim();

        // Add periods at the end of paragraphs if missing
        processed = processed.replace(/\n\n/g, ". ");

        return processed;
    }

    /**
     * Get available voices
     */
    getAvailableVoices(): string[] {
        return Object.values(this.VOICES);
    }

    /**
     * Generate narration audio for the entire script in one request
     * No chunking needed - Gemini 2.5 Flash TTS can handle 5-10 minutes
     */
    async generateNarrationAudio(
        narration: string,
        outputPath: string,
        config?: GeminiTTSConfig
    ): Promise<string> {
        console.error(`\n🎬 === NARRATION AUDIO GENERATION ===`);
        console.error(`📊 Narration stats:`);
        console.error(`   Characters: ${narration.length}`);
        console.error(`   Words: ${narration.split(/\s+/).length}`);
        console.error(`   Estimated duration: ${(narration.split(/\s+/).length / 150).toFixed(1)} minutes`);
        console.error(`🚀 Using Gemini 2.5 Flash TTS (single request, no chunking)`);

        try {
            const audioPath = await this.generateSpeechToFile(
                narration,
                outputPath,
                config || { voice: this.VOICES.PUCK } // Default to Puck voice
            );

            console.error(`✅ Narration audio generated successfully!`);
            return audioPath;

        } catch (error: any) {
            console.error(`❌ Failed to generate narration audio:`, error);
            throw new Error(`Narration audio generation failed: ${error.message || error}`);
        }
    }

    /**
     * Create a silent WAV audio file of specified duration
     * Used for scenes with empty narration (e.g., hook scenes)
     */
    private async createSilenceAudio(
        outputPath: string,
        durationSeconds: number
    ): Promise<string> {
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;

        // Calculate number of samples needed
        const numSamples = Math.floor(sampleRate * durationSeconds);
        const dataSize = numSamples * numChannels * bytesPerSample;

        // Create silent PCM data (all zeros)
        const silentData = Buffer.alloc(dataSize, 0);

        // Add WAV header
        const wavBuffer = this.addWavHeader(silentData);

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write to file
        const wavPath = outputPath.replace(/\.\w+$/, '.wav');
        fs.writeFileSync(wavPath, wavBuffer);

        console.error(`💾 Silent audio created: ${wavPath} (${durationSeconds}s)`);
        console.error(`📊 File size: ${(wavBuffer.length / 1024).toFixed(2)} KB`);

        return wavPath;
    }

    async generateNarrationAudios(
        jobId: string,
        narrations: string[],
        outputDir: string,
        config?: GeminiTTSConfig
    ): Promise<string[]> {
        const audioUrls: string[] = [];

        for (let i = 0; i < narrations.length; i++) {
            console.error(`Generating narration part ${i + 1} of ${narrations.length}...`);

            const narration = narrations[i];
            const outputPath = path.join(outputDir, `narration-part-${i + 1}.wav`);

            console.error(`\n🎬 Generating narration part ${i + 1} of ${narrations.length}...`);

            try {
                let audioPath: string;

                // Check if narration is empty (hook scene or silent scene)
                if (!narration || narration.trim() === '') {
                    console.error(`🔇 Empty narration detected - creating 1 second silence`);
                    audioPath = await this.createSilenceAudio(outputPath, 1.0);
                } else {
                    audioPath = await this.generateNarrationAudio(
                        narration,
                        outputPath,
                        config
                    );
                }

                console.error(`Uploading narration part ${i + 1} of ${narrations.length} to Cloudinary...`);

                const upload = await this.cloudinaryService.uploadAudio(
                    audioPath,
                    `narrations/${jobId}`,
                    `part-${i + 1}`
                );

                console.error(`✅ Narration part ${i + 1} uploaded to Cloudinary: ${upload.secureUrl}`);
                audioUrls.push(upload.secureUrl);

                // Clean up local file

                await fs.promises.unlink(audioPath);

            } catch (error) {
                console.error(`❌ Failed to generate narration part ${i + 1}:`, error);
                throw error;
            }
        }

        return audioUrls;
    }
}

export default GeminiTTSService;
