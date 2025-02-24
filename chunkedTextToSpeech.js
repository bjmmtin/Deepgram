const https = require("https");
const fs = require("fs");
require("dotenv").config();

const DEEPGRAM_URL = "https://api.deepgram.com/v1/speak?model=aura-helios-en";
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const inputText =
  "Our story begins in a peaceful woodland kingdom where a lively squirrel named Frolic made his abode high up within a cedar tree's embrace. He was not a usual woodland creature, for he was blessed with an insatiable curiosity and a heart for adventure. Nearby, a glistening river snaked through the landscape, home to a wonder named Splash - a silver-scaled flying fish whose ability to break free from his water-haven intrigued the woodland onlookers. This magical world moved on a rhythm of its own until an unforeseen circumstance brought Frolic and Splash together. One radiant morning, while Frolic was on his regular excursion, and Splash was making his aerial tours, an unpredictable wave playfully tossed and misplaced Splash onto the riverbank. Despite his initial astonishment, Frolic hurriedly and kindly assisted his new friend back to his watery abode. Touched by Frolic's compassion, Splash expressed his gratitude by inviting his friend to share his world. As Splash perched on Frolic's back, he tasted of the forest's bounty, felt the sun’s rays filter through the colors of the trees, experienced the conversations amidst the woods, and while at it, taught the woodland how to blur the lines between earth and water.";
const outputFilename = "output_chunked.mp3";

function segmentTextBySentence(text) {
  return text.match(/[^.!?]+[.!?]/g).map((sentence) => sentence.trim());
}

function synthesizeAudio(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ text });
    const options = {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(DEEPGRAM_URL, options, (res) => {
      let data = [];

      res.on("data", (chunk) => {
        data.push(chunk);
      });

      res.on("end", () => {
        resolve(Buffer.concat(data));
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  const segments = segmentTextBySentence(inputText);

  // Create or truncate the output file
  const outputFile = fs.createWriteStream(outputFilename);

  for (const segment of segments) {
    try {
      const audioData = await synthesizeAudio(segment);
      outputFile.write(audioData);
      console.log("Audio stream finished for segment:", segment);
    } catch (error) {
      console.error("Error synthesizing audio:", error);
    }
  }

  console.log("Audio file creation completed.");
}

main();
