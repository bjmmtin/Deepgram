const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Since we can't directly use pydub in JavaScript, we'll need to handle raw audio data
// or use a different audio processing library if needed
const encodingSamplewidthMap = {
    "linear16": 2,
    "mulaw": 1
};

function getCurrentTimeString() {
    const now = new Date();
    return now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
}

function saveAudio(encoding, sampleRate, channels, data) {
    // Create current timestamp for filename
    const filename = getCurrentTimeString();
    const extension = 'raw';
    const dataDir = path.join(process.cwd(), 'data');

    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    // Save raw audio data
    const rawFilePath = path.join(dataDir, `${filename}.${extension}`);
    fs.writeFileSync(rawFilePath, data);

    // Note: For WAV conversion, you would need to use a library like 'wav' or 'audio-converter'
    // The following is simplified to just return the raw file path
    return rawFilePath;
}

async function logger(ws, message, key = "msg") {
    console.log(message);
    const msgDict = {};
    msgDict[key] = message;
    ws.send(JSON.stringify(msgDict));
}

function createWebSocketServer() {
    const server = http.createServer();
    const wss = new WebSocket.Server({ server });

    wss.on('connection', async (ws, req) => {
        // Parse query parameters
        const queryParams = url.parse(req.url, true).query;
        const encoding = queryParams.encoding || '';
        const sampleRate = parseInt(queryParams.sample_rate) || 0;
        const channels = parseInt(queryParams.channels) || 1;

        await logger(ws, "New websocket connection opened");
        await logger(
            ws,
            `Expecting audio data with encoding ${encoding}, ${sampleRate} sample rate, and ${channels} channel(s)`
        );

        // Calculate expected bytes per second for supported encodings
        const sampleWidth = encodingSamplewidthMap[encoding];
        let expectedBytesPerSecond;
        if (sampleWidth) {
            expectedBytesPerSecond = sampleWidth * sampleRate * channels;
        }

        const startTime = Date.now();
        let bytesReceived = 0;
        let audioData = Buffer.from([]);

        ws.on('message', async (message) => {
            // Handle binary messages (audio data)
            if (message instanceof Buffer) {
                bytesReceived += message.length;
                audioData = Buffer.concat([audioData, message]);

                if (sampleWidth) {
                    const elapsedTime = (Date.now() - startTime) / 1000; // Convert to seconds
                    if (bytesReceived / elapsedTime > expectedBytesPerSecond) {
                        await logger(ws, "Warning: stream may be faster than real time!");
                    }
                }

                await logger(ws, `Received ${bytesReceived} bytes of data`);
            } else {
                // Handle text messages
                try {
                    const jsonMessage = JSON.parse(message.toString());
                    if (jsonMessage.type === "CloseStream") {
                        const filename = saveAudio(encoding, sampleRate, channels, audioData);
                        await logger(ws, filename, "filename");
                        await logger(ws, audioData.length, "total_bytes");
                        ws.close();
                    } else {
                        ws.close(1011, "Invalid frame sent");
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                    ws.close(1011, "Invalid frame sent");
                }
            }
        });

        ws.on('close', () => {
            console.log("Client closed connection");
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    return server;
}

function startServer() {
    const port = 5000;
    const server = createWebSocketServer();
    
    server.listen(port, () => {
        console.log(`Server is now listening for new connections on port ${port}`);
    });
}

// Start the server
startServer();
