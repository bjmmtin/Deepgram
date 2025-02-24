const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Constants
const REALTIME_RESOLUTION = 250; // 0.250 seconds in milliseconds
const ENCODING_SAMPLEWIDTH_MAP = {
    "linear16": 2,
    "mulaw": 1
};

class AudioStreamer {
    constructor(audioFilePath, encoding, sampleRate, channels) {
        this.audioFilePath = audioFilePath;
        this.encoding = encoding;
        this.sampleRate = sampleRate;
        this.channels = channels;
        // Buffer to store received data
        this.receivedData = Buffer.alloc(0);
    }

    async connect() {
        try {
            const url = new URL('ws://localhost:5000');
            url.searchParams.append('encoding', this.encoding);
            url.searchParams.append('sample_rate', this.sampleRate);
            url.searchParams.append('channels', this.channels);

            // For Deepgram, use this URL instead:
            // const url = new URL('wss://api.deepgram.com/v1/listen');

            const ws = new WebSocket(url.toString(), {
                headers: {
                    // If testing with Deepgram, uncomment and add your API key
                    // 'Authorization': 'Token YOUR_DG_API_KEY'
                }
            });

            console.log('🟢 (1/5) Successfully opened streaming connection');

            // Set up event handlers
            await this.setupWebSocket(ws);

            // Start streaming
            await this.streamAudio(ws);

        } catch (error) {
            console.error('🔴 ERROR: Could not connect to server!', error);
        }
    }

    setupWebSocket(ws) {
        return new Promise((resolve, reject) => {
            let isFirstMessage = true;

            ws.on('open', () => {
                console.log('🟢 (2/5) Ready to stream data');
                resolve();
            });

            ws.on('message', (data) => {
                // Check if the message is JSON
                let jsonMessage;
                try {
                    jsonMessage = JSON.parse(data.toString());
                    this.handleJsonMessage(jsonMessage);
                } catch (e) {
                    // If not JSON, treat as binary audio data
                    this.handleBinaryMessage(data);
                }

                if (isFirstMessage) {
                    console.log('🟢 (3/5) Successfully receiving server messages');
                    isFirstMessage = false;
                }
            });

            ws.on('error', (error) => {
                reject(error);
            });

            ws.on('close', () => {
                this.saveReceivedData();
            });
        });
    }

    handleJsonMessage(res) {
        // Handle DG transcriptions
        const transcript = res?.channel?.alternatives?.[0]?.transcript;

        // Handle local server messages
        if (res.msg) {
            console.log(`Server message: ${res.msg}`);
        } else if (transcript) {
            console.log(`DG transcript: ${transcript}`);
        }

        if (res.filename) {
            const rawFilename = `${path.parse(res.filename).name}.raw`;
            console.log(`🟢 (5/5) Sent audio data was stored in ${rawFilename}`);
            if (path.parse(res.filename).ext !== '.raw') {
                console.log(`🟢 (5/5) Sent audio data was also containerized and saved in ${res.filename}`);
            }
        }
    }

    handleBinaryMessage(data) {
        // Concatenate received binary data
        this.receivedData = Buffer.concat([this.receivedData, data]);
    }

    saveReceivedData() {
        console.log("Connection closed!!");
        
        if (this.receivedData.length > 0) {
            // Generate filename based on timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rawFilename = `received_${timestamp}.raw`;
            
            // Save the raw audio data
            fs.writeFileSync(rawFilename, this.receivedData);
            console.log(`🟢 Saved received audio data to ${rawFilename}`);

            // Clear the buffer
            this.receivedData = Buffer.alloc(0);
        }
    }

    async streamAudio(ws) {
        try {
            const data = fs.readFileSync(this.audioFilePath);
            let offset = 0;

            // Calculate chunk size
            let chunkSize;
            const sampleWidth = ENCODING_SAMPLEWIDTH_MAP[this.encoding];
            if (sampleWidth) {
                // How many bytes are contained in one second of audio?
                const byteRate = sampleWidth * this.sampleRate * this.channels;
                // How many bytes are in REALTIME_RESOLUTION seconds of audio?
                chunkSize = Math.floor(byteRate * (REALTIME_RESOLUTION / 1000));
            } else {
                chunkSize = 5000;
            }

            while (offset < data.length) {
                const chunk = data.slice(offset, offset + chunkSize);
                offset += chunkSize;

                // Send chunk
                ws.send(chunk);

                // Mimic real-time by waiting REALTIME_RESOLUTION milliseconds
                await new Promise(resolve => setTimeout(resolve, REALTIME_RESOLUTION));
            }

            // Send close stream message
            ws.send(JSON.stringify({ type: 'CloseStream' }));
            console.log('🟢 (4/5) Successfully closed connection, waiting for final messages if necessary');

        } catch (error) {
            console.error('Error streaming audio:', error);
            ws.close();
        }
    }
}

// Command line argument parsing
function parseArgs() {
    const args = {
        input: process.argv.find(arg => arg.startsWith('--input='))?.split('=')[1] || 'preamble.raw',
        encoding: process.argv.find(arg => arg.startsWith('--encoding='))?.split('=')[1] || 'linear16',
        sampleRate: parseInt(process.argv.find(arg => arg.startsWith('--sample-rate='))?.split('=')[1] || '8000'),
        channels: parseInt(process.argv.find(arg => arg.startsWith('--channels='))?.split('=')[1] || '1')
    };

    // Validate input file
    if (!fs.existsSync(args.input)) {
        throw new Error(`${args.input} is an invalid file path.`);
    }

    // Validate encoding
    const validEncodings = ['linear16', 'flac', 'mulaw', 'amr-nb', 'amr-wb', 'opus', 'speex'];
    if (!validEncodings.includes(args.encoding.toLowerCase())) {
        throw new Error(`${args.encoding} is not a supported encoding.`);
    }

    return args;
}

// Main function
async function main() {
    try {
        const args = parseArgs();
        const streamer = new AudioStreamer(
            args.input,
            args.encoding.toLowerCase(),
            args.sampleRate,
            args.channels
        );
        await streamer.connect();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

// Run the program
if (require.main === module) {
    main();
}
