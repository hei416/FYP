
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/run-code", async (req, res) => {
    try {
        const { code } = req.body;

        const createRes = await fetch("https://api.paiza.io/runners/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                source_code: code,
                language: "java",
                api_key: "guest",
            }),
        });

        const { id } = await createRes.json();
        if (!id) return res.status(500).json({ error: "Failed to create execution" });

        // Poll until completed
        let statusData;
        while (true) {
            const statusRes = await fetch(
                `https://api.paiza.io/runners/get_details?api_key=guest&id=${id}`
            );
            statusData = await statusRes.json();

            if (statusData.status === "completed") break;

            await new Promise((r) => setTimeout(r, 1000));
        }

        res.json({ output: statusData.stdout || statusData.stderr || "No output" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = 8000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));
