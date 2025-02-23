const { createClient } = require("@deepgram/sdk");
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

    // Convert result to JSON string
    const jsonData = JSON.stringify(result, null, 2);

    // Save to a file
    fs.writeFileSync("transcription.json", jsonData, "utf-8");
    
    console.log("Transcription saved to transcription.json");
  } catch (err) {
    console.error("Error:", err);
  }
};

transcribeUrl();
