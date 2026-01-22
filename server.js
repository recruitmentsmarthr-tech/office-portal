require('dotenv').config();
const express = require('express');
const session = require('express-session'); // Added
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const app = express();
const port = 80;

// Folders
const UPLOADS_DIR = 'uploads';
const CHUNKS_DIR = 'chunks';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR);

// Session Configuration
app.use(session({
    secret: 'pta-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Logged in for 24 hours
}));

app.use(express.json({ limit: '50mb' }));
const upload = multer({ dest: UPLOADS_DIR + '/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-2.5-pro";

// --- AUTHENTICATION MIDDLEWARE ---
const checkAuth = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.status(401).send('Unauthorized: Please log in.');
    }
};

// --- LOGIN ROUTE ---
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.SYSTEM_PASSWORD) {
        req.session.isLoggedIn = true;
        res.status(200).send('Login successful');
    } else {
        res.status(401).send('Incorrect Password');
    }
});

// Protect static files
app.get('/', (req, res) => {
    if (!req.session.isLoggedIn) {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.use(express.static('public'));

// Protect API routes
app.post('/generate-minutes', checkAuth, async (req, res) => {

    try {
        const { transcript } = req.body;
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: `Elite bilingual secretary. Format: 1.ရည်ရွယ်ချက် 2.ဆွေးနွေးချက် 3.ဆုံးဖြတ်ချက်(Table) 4.အထွေထွေ.`
        });
        const result = await model.generateContent(`Generate formal minutes from:\n${transcript}`);
        res.send(result.response.text());
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/transcribe', checkAuth, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");
        const inputPath = req.file.path;
        const fileExtension = path.extname(req.file.originalname) || '.m4a';
        const chunkPrefix = path.join(CHUNKS_DIR, `chunk_${Date.now()}_%03d${fileExtension}`);
        execSync(`ffmpeg -i ${inputPath} -f segment -segment_time 900 -c copy "${chunkPrefix}"`);
        const chunks = fs.readdirSync(CHUNKS_DIR).filter(f => f.startsWith('chunk_') && f.endsWith(fileExtension)).sort();

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        for (let i = 0; i < chunks.length; i++) {
            const chunkName = chunks[i];
            const chunkPath = path.join(CHUNKS_DIR, chunkName);
            let googleFileName = null;
            try {
                res.write(`[[SEGMENT_INFO:${i + 1}/${chunks.length}]]\n`);
                const upResponse = await fileManager.uploadFile(chunkPath, { mimeType: req.file.mimetype, displayName: chunkName });
                googleFileName = upResponse.file.name;
                let file = await fileManager.getFile(googleFileName);
                while (file.state === "PROCESSING") { await new Promise(r => setTimeout(r, 3000)); file = await fileManager.getFile(googleFileName); }

                const model = genAI.getGenerativeModel({

                    model: MODEL_NAME,
                    systemInstruction: `Professional Secretary. Transcribe Burmese/English CLEAN VERBATIM. MANDATORY: Start every turn with Speaker 1: or S>
                });
                const result = await model.generateContentStream([{ text: "Transcribe. Identify speakers." }, { fileData: { fileUri: file.uri, mimeType: fi>
                for await (const chunk of result.stream) { const text = chunk.text(); if (text) res.write(text); }
                await fileManager.deleteFile(googleFileName).catch(() => {});
                if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
                if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 10000));
            } catch (chunkErr) { res.write(`\n[ERROR]: ${chunkErr.message}\n`); }
        }
    } catch (err) { if (!res.headersSent) res.status(500).send(err.message); }
    finally { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.end(); }
});

const server = app.listen(port, () => console.log(`✅ Locked Workspace on Port ${port}`));
server.setTimeout(7200000);



















