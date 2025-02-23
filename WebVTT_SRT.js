const { createClient, webvtt, srt } = require("@deepgram/sdk");
const fs = require("fs");
require("dotenv").config();

const transcribeUrl = async () => {
    try {
        const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

        const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
            {
                url: "https://dpgr.am/spacewalk.wav",
            },
            {
                model: "nova-3",
                smart_format: true,
            }
        );

        if (error) throw error;

        // WebVTT Filename
        const stream_vtt = fs.createWriteStream("output.vtt", { flags: "a" });
        // SRT Filename
        const stream_srt = fs.createWriteStream("output.srt", { flags: "a" });

        const captions_vtt = webvtt(result);
        const captions_srt = srt(result);
        stream_vtt.write(captions_vtt);
        stream_srt.write(captions_srt);

        console.log("Transcription saved to output.vtt & output.srt");
    } catch (err) {
        console.error("Error:", err);
    }
};

transcribeUrl();
