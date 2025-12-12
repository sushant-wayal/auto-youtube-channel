/**
 * Gemini TTS Service
 * Uses Google's Gemini 2.5 Flash Preview TTS model for high-quality voice generation
 * Handles long-form narration (5-10 minutes) in a single request
 */

import GeminiClient from "../ai/gemini-client";
import type { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

export interface GeminiTTSConfig {
    voice?: string; // Voice selection (Puck, Charon, Kore, Fenrir, Aoede)
    speed?: number; // Speed multiplier (0.25 to 4.0)
}

class GeminiTTSService {
    private genAI: GoogleGenAI;
    private readonly MODEL_NAME = "gemini-2.5-flash-preview-tts"; // Correct TTS model name

    // Available voices for Gemini TTS
    private readonly VOICES = {
        PUCK: "Puck",      // Friendly, warm voice
        CHARON: "Charon",  // Deep, authoritative voice
        KORE: "Kore",      // Clear, professional voice
        FENRIR: "Fenrir",  // Strong, confident voice
        AOEDE: "Aoede",    // Soft, pleasant voice
    };

    constructor() {
        this.genAI = GeminiClient.getInstance().getGenAI();
    }

    /**
     * Generate speech from text using Gemini 2.5 Flash Preview TTS
     * Can handle long-form content (5-10 minutes) in a single request
     */
    async generateSpeech(
        text: string,
        config?: GeminiTTSConfig
    ): Promise<Buffer> {
        console.log(`\n🎙️ === GEMINI TTS GENERATION STARTED ===`);
        console.log(`📝 Text length: ${text.length} characters`);
        console.log(`🎤 Voice: ${config?.voice || this.VOICES.PUCK}`);
        console.log(`⚡ Speed: ${config?.speed || 1.0}x`);

        try {
            // Process text for better TTS output
            const processedText = this.processNarrationForTTS(text);

            // Build speech config
            const speechConfig: any = {};

            if (config?.voice) {
                speechConfig.voiceConfig = {
                    prebuiltVoiceConfig: {
                        voiceName: config.voice
                    }
                };
            }

            if (config?.speed) {
                speechConfig.speed = config.speed;
            }

            console.log(`🚀 Generating audio with Gemini 2.5 Flash Preview TTS...`);
            console.log(`⏳ This may take 10-30 seconds for long narrations...`);

            const result = await this.genAI.models.generateContent({
                model: this.MODEL_NAME,
                contents: processedText,
                config: {
                    temperature: 1,
                    maxOutputTokens: 8192,
                    responseModalities: ["AUDIO"],
                    speechConfig: Object.keys(speechConfig).length > 0 ? speechConfig : undefined,
                },
            });

            // Extract audio data from response
            if (!result.candidates || result.candidates.length === 0) {
                throw new Error("No audio generated in response");
            }

            const candidate = result.candidates[0];

            // Extract audio from inline data
            if (candidate.content?.parts && candidate.content.parts.length > 0) {
                const audioPart = candidate.content.parts.find((part: any) => part.inlineData);

                if (!audioPart || !audioPart.inlineData) {
                    throw new Error("No audio data found in response");
                }

                // Convert base64 audio to buffer
                const audioBase64 = audioPart.inlineData.data;
                if (!audioBase64) {
                    throw new Error("No audio data in inline data");
                }
                const audioBuffer = Buffer.from(audioBase64, 'base64');

                console.log(`✅ Generated ${audioBuffer.length} bytes of audio`);
                console.log(`🎵 Audio format: ${audioPart.inlineData.mimeType || 'audio/wav'}`);
                console.log(`✅ === GEMINI TTS GENERATION COMPLETE ===\n`);

                return audioBuffer;
            }

            throw new Error("No audio data in response parts");

        } catch (error: any) {
            console.error(`❌ Gemini TTS generation failed:`, error);
            throw new Error(`Failed to generate speech with Gemini TTS: ${error.message || error}`);
        }
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

            console.log(`💾 Audio saved to: ${wavPath}`);
            console.log(`📊 File size: ${(wavBuffer.length / 1024 / 1024).toFixed(2)} MB`);

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
     * Removes [PAUSE] markers and prepares text
     */
    processNarrationForTTS(narration: string): string {
        // Replace [PAUSE] with commas for natural pauses
        let processed = narration.replace(/\[PAUSE\]/g, ", ");

        // Remove extra whitespace
        processed = processed.replace(/\s+/g, " ").trim();

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
        console.log(`\n🎬 === NARRATION AUDIO GENERATION ===`);
        console.log(`📊 Narration stats:`);
        console.log(`   Characters: ${narration.length}`);
        console.log(`   Words: ${narration.split(/\s+/).length}`);
        console.log(`   Estimated duration: ${(narration.split(/\s+/).length / 150).toFixed(1)} minutes`);
        console.log(`🚀 Using Gemini 2.5 Flash TTS (single request, no chunking)`);

        try {
            const audioPath = await this.generateSpeechToFile(
                narration,
                outputPath,
                config || { voice: this.VOICES.PUCK } // Default to Puck voice
            );

            console.log(`✅ Narration audio generated successfully!`);
            return audioPath;

        } catch (error: any) {
            console.error(`❌ Failed to generate narration audio:`, error);
            throw new Error(`Narration audio generation failed: ${error.message || error}`);
        }
    }
}

export default GeminiTTSService;
