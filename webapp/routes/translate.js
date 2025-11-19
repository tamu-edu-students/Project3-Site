const express = require("express");
const router = express.Router();
require("dotenv").config();
const fetch = require("node-fetch");

// Helper: split array into chunks
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

router.post("/", async (req, res) => {
    try {
        const { texts, target } = req.body;
        const apiKey = process.env.TRANSLATION_KEY;
        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

        const CHUNK_SIZE = 100; // Google API limit ~128 segments, safer to use 100
        const chunks = chunkArray(texts, CHUNK_SIZE);
        const translations = [];

        for (const chunk of chunks) {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    q: chunk,
                    target: target
                })
            });

            const json = await response.json();

            if (!json.data || !json.data.translations) {
                console.error("Google API Error:", json);
                return res.status(500).json({ error: "Translation failed" });
            }

            translations.push(...json.data.translations.map(t => t.translatedText));
        }

        res.json({ translations });

    } catch (err) {
        console.error("Translation Error:", err);
        res.status(500).json({ error: "Translation failed" });
    }
});

module.exports = router;
