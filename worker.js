// worker.js
const axios = require('axios');
const Groq = require('groq-sdk');

// --- NHẬN DỮ LIỆU TỪ INDEX.JS ---
// Thứ tự nhận: [0]=Token User, [1]=Channel ID, [2]=Groq Key
const args = process.argv.slice(2);

if (args.length < 3) {
    console.error("Thiếu tham số! Cần: Token, Channel ID, Groq Key");
    process.exit(1);
}

const TOKEN = args[0];
const CHANNEL_ID = args[1];
const GROQ_API_KEY = args[2]; // <--- Nhận Key từ đây

const BOT_PERSONA = "một game thủ Discord, trẻ trâu, hài hước, cục súc, trả lời ngắn gọn dưới 20 từ";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function askGroq(userMessage) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `Bạn đang chat trên Discord. Hãy đóng vai: ${BOT_PERSONA}. Trả lời câu này: '${userMessage}'` },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile",
        });
        return chatCompletion.choices[0]?.message?.content?.trim();
    } catch (e) { return null; }
}

async function main() {
    const headers = { "Authorization": TOKEN, "Content-Type": "application/json" };
    let myId = null;

    // Login check
    try {
        const me = await axios.get("https://discord.com/api/v9/users/@me", { headers });
        myId = me.data.id;
        console.log(`[LOGIN OK] ${me.data.username}`);
    } catch (e) {
        console.log("[LỖI] Token Discord sai!"); return;
    }

    const url = `https://discord.com/api/v9/channels/${CHANNEL_ID}/messages`;
    let lastProcessedId = null;

    // Lấy tin nhắn cuối
    try {
        const init = await axios.get(url, { headers, params: { limit: 1 } });
        if (init.data.length > 0) lastProcessedId = init.data[0].id;
    } catch (e) {}

    console.log(`>>> Worker đang chạy kênh: ${CHANNEL_ID}`);

    while (true) {
        try {
            const res = await axios.get(url, { headers, params: { limit: 1 } });
            if (res.data.length > 0) {
                const msg = res.data[0];
                if (msg.id !== lastProcessedId && msg.author.id !== myId) {
                    lastProcessedId = msg.id;
                    console.log(`[Khách]: ${msg.content}`);
                    
                    const reply = await askGroq(msg.content);
                    if (reply) {
                        await axios.post(url, { content: reply, message_reference: { message_id: msg.id, channel_id: CHANNEL_ID } }, { headers });
                        console.log(`[Bot]: ${reply}`);
                        await sleep(4000);
                    }
                }
            }
        } catch (e) { if (e.response?.status === 429) await sleep(5000); }
        await sleep(1000);
    }
}
main();
