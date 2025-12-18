import HuggingFaceClient from "./huggingface-client";
import fs from "fs";
import path from "path";

export interface TTSConfig {
    speed?: number; // Speed multiplier (0.5 to 2.0)
}

class TTSService {
    private client: HuggingFaceClient;
    // Use models that actually work with HF Inference API
    private models = [
        "facebook/fastspeech2-en-ljspeech",
        "espnet/kan-bayashi_ljspeech_joint_finetune_conformer_fastspeech2_hifigan",
    ];
    private currentModel: string = this.models[0];

    constructor() {
        this.client = HuggingFaceClient.getInstance();
    }

    /**
     * Generate speech from text using Hugging Face TTS
     * Note: HF free API has limitations, results may vary
     */
    async generateSpeech(
        text: string,
        config?: TTSConfig
    ): Promise<Buffer> {
        console.log(`🎙️ Generating speech for: "${text.substring(0, 50)}..."`);
        console.log(`📊 Text length: ${text.length} characters`);

        const hf = this.client.getHF();

        // Try each model until one works
        for (const model of this.models) {
            try {
                console.log(`🤖 Trying model: ${model}`);

                const response = await hf.textToSpeech({
                    model: model,
                    inputs: text,
                });

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                console.log(`✅ Generated ${buffer.length} bytes of audio with model: ${model}`);
                this.currentModel = model;
                return buffer;
            } catch (error: any) {
                console.error(`❌ Model ${model} failed:`, error?.message || error);

                // Check if model is loading
                if (error?.message?.includes("loading") || error?.message?.includes("currently loading")) {
                    console.log(`⏳ Model ${model} is loading, waiting 25 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 25000));

                    // Retry once
                    try {
                        const retryResponse = await hf.textToSpeech({
                            model: model,
                            inputs: text,
                        });
                        const arrayBuffer = await retryResponse.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        console.log(`✅ Generated ${buffer.length} bytes of audio with model: ${model} (after retry)`);
                        this.currentModel = model;
                        return buffer;
                    } catch (retryError) {
                        console.error(`❌ Retry failed for ${model}`);
                        continue;
                    }
                }

                continue;
            }
        }

        // If all models failed, throw error with helpful message
        throw new Error(
            `⚠️ All Hugging Face TTS models failed. This is common with the free API.\n` +
            `Options:\n` +
            `1. Wait a few minutes and try again (models may be cold starting)\n` +
            `2. Use a shorter script (current: ${text.length} chars)\n` +
            `3. Get an OpenAI API key for reliable TTS ($0.015/1000 chars)`
        );
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
        config?: TTSConfig
    ): Promise<string> {
        try {
            const audioBuffer = await this.generateSpeech(text, config);

            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write to file
            fs.writeFileSync(outputPath, audioBuffer);

            return outputPath;
        } catch (error) {
            console.error("Error saving speech to file:", error);
            throw new Error(`Failed to save speech to file: ${error}`);
        }
    }

    /**
     * Process narration text for better TTS output
     * Removes [PAUSE] markers and prepares text
     */
    processNarrationForTTS(narration: string): string {
        // Replace [PAUSE] with commas for natural pauses
        let processed = narration.replace(/\[PAUSE\]/g, ",");

        // Remove extra whitespace
        processed = processed.replace(/\s+/g, " ").trim();

        return processed;
    }

    /**
     * Split long text into VERY small chunks for HF free API
     * Free API often fails with long text
     */
    splitTextForTTS(text: string, maxLength: number = 200): string[] {
        if (text.length <= maxLength) {
            return [text];
        }

        const chunks: string[] = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let currentChunk = "";

        for (const sentence of sentences) {
            // If single sentence is too long, split it further
            if (sentence.length > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = "";
                }
                // Split long sentence by commas or spaces
                const parts = sentence.split(/,|\s+/);
                let subChunk = "";
                for (const part of parts) {
                    if ((subChunk + part).length <= maxLength) {
                        subChunk += (subChunk ? " " : "") + part;
                    } else {
                        if (subChunk) chunks.push(subChunk.trim());
                        subChunk = part;
                    }
                }
                if (subChunk) chunks.push(subChunk.trim());
            } else if ((currentChunk + sentence).length <= maxLength) {
                currentChunk += sentence;
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Generate speech from long text by splitting and concatenating
     */
    async generateLongFormSpeech(
        text: string,
        outputPath: string,
        config?: TTSConfig
    ): Promise<string> {
        try {
            const processedText = this.processNarrationForTTS(text);
            const chunks = this.splitTextForTTS(processedText, 200); // Small chunks for HF

            console.log(`📝 Splitting narration into ${chunks.length} chunks for TTS`);
            console.log(`⚠️ Using Hugging Face free API - this may take 5-10 minutes`);
            console.log(`⏳ First chunk may take 25-30s (model cold start)`);
            console.log(`💡 For faster/reliable results, consider using OpenAI TTS`);

            const audioBuffers: Buffer[] = [];

            for (let i = 0; i < chunks.length; i++) {
                console.log(`\n🎙️ Generating audio chunk ${i + 1}/${chunks.length}...`);
                console.log(`📝 Chunk text: "${chunks[i].substring(0, 60)}..."`);

                try {
                    const buffer = await this.generateSpeech(chunks[i], config);
                    audioBuffers.push(buffer);
                    console.log(`✅ Chunk ${i + 1}/${chunks.length} successful (${buffer.length} bytes)`);

                    // Longer delay for HF free API to avoid rate limiting
                    if (i < chunks.length - 1) {
                        console.log(`⏸️ Waiting 3 seconds before next chunk...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                } catch (error: any) {
                    console.error(`❌ Chunk ${i + 1} failed:`, error?.message);

                    // Don't stop immediately, maybe some chunks work
                    console.warn(`⚠️ Skipping failed chunk and continuing...`);
                    continue;
                }
            }

            if (audioBuffers.length === 0) {
                throw new Error(
                    `Failed to generate any audio chunks. ` +
                    `Hugging Face free API is unreliable. ` +
                    `Please try again in a few minutes or use OpenAI TTS.`
                );
            }

            if (audioBuffers.length < chunks.length) {
                console.warn(
                    `⚠️ Only generated ${audioBuffers.length}/${chunks.length} chunks successfully. ` +
                    `Audio will be incomplete.`
                );
            }

            console.log(`\n✅ Successfully generated ${audioBuffers.length}/${chunks.length} chunks`);

            // Concatenate all audio buffers
            const finalBuffer = Buffer.concat(audioBuffers);

            // Ensure directory exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Write to file
            fs.writeFileSync(outputPath, finalBuffer);

            console.log(`✅ Audio saved to: ${outputPath} (${finalBuffer.length} bytes)`);
            return outputPath;
        } catch (error: any) {
            console.error("❌ Error generating long-form speech:", error?.message);
            throw new Error(`Failed to generate long-form speech: ${error?.message || error}`);
        }
    }
}

export default TTSService;
