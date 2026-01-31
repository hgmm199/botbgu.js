// ==================== FILE: worker.js ====================
const axios = require('axios');
const Groq = require('groq-sdk');

// --- NHẬN DỮ LIỆU TỪ INDEX.JS ---
const args = process.argv.slice(2);
// [0]: Token User, [1]: ChannelID, [2]: GroqKey

if (args.length < 3) {
    // console.error("Thiếu tham số!");
    process.exit(1);
}

const TOKEN = args[0];
const CHANNEL_ID = args[1];
const GROQ_API_KEY = args[2];

const BOT_PERSONA = "một game thủ Discord, trẻ trâu, hài hước, cục súc, trả lời ngắn gọn dưới 20 từ, không sến súa";

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
    const headers = { 
        "Authorization": TOKEN, 
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    };
    
    let myId = null;

    // 1. Kiểm tra Login
    try {
        const me = await axios.get("https://discord.com/api/v9/users/@me", { headers });
        myId = me.data.id;
        console.log(`[WORKER STARTED] Login: ${me.data.username} | Kênh: ${CHANNEL_ID}`);
    } catch (e) {
        console.log("[WORKER LỖI] Token sai hoặc bị khóa.");
        process.exit(1);
    }

    const url = `https://discord.com/api/v9/channels/${CHANNEL_ID}/messages`;
    let lastProcessedId = null;

    // 2. Lấy tin nhắn cuối làm mốc
    try {
        const init = await axios.get(url, { headers, params: { limit: 1 } });
        if (init.data.length > 0) lastProcessedId = init.data[0].id;
    } catch (e) {}

    // 3. Vòng lặp chính
    while (true) {
        try {
            const res = await axios.get(url, { headers, params: { limit: 1 } });
            
            if (res.data.length > 0) {
                const msg = res.data[0];
                
                // Nếu tin mới + Không phải của mình
                if (msg.id !== lastProcessedId && msg.author.id !== myId) {
                    lastProcessedId = msg.id;
                    console.log(`[Khách]: ${msg.content}`);
                    
                    const reply = await askGroq(msg.content);
                    
                    if (reply) {
                        await axios.post(url, { 
                            content: reply, 
                            message_reference: { message_id: msg.id, channel_id: CHANNEL_ID } 
                        }, { headers });
                        console.log(`[Bot]: ${reply}`);
                        await sleep(5000); // Nghỉ 5s sau khi chat
                    }
                }
            }
        } catch (e) { 
            if (e.response && e.response.status === 429) await sleep(10000); 
        }
        await sleep(2000); // Check tin nhắn 2s/lần
    }
}

main();
