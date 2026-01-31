// ==================== FILE: worker.js ====================
const axios = require('axios');
const Groq = require('groq-sdk');

// --- NHẬN DỮ LIỆU TỪ INDEX.JS ---
// [0]: Node, [1]: File, [2]: Token, [3]: ChannelID, [4]: GroqKey
const args = process.argv.slice(2);

if (args.length < 3) {
    console.error("[LỖI WORKER] Thiếu tham số! Cần: Token, Channel ID, Groq Key");
    process.exit(1);
}

const TOKEN = args[0];
const CHANNEL_ID = args[1];
const GROQ_API_KEY = args[2]; 

// Cấu hình tính cách
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
    // Giả lập trình duyệt để tránh bị chặn
    const headers = { 
        "Authorization": TOKEN, 
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    };
    
    let myId = null;

    // 1. Check Login
    try {
        const me = await axios.get("https://discord.com/api/v9/users/@me", { headers });
        myId = me.data.id;
        console.log(`[LOGIN OK] User: ${me.data.username} | ID: ${myId}`);
    } catch (e) {
        console.log("[LỖI] Token sai hoặc bị khóa."); 
        process.exit(1);
    }

    const url = `https://discord.com/api/v9/channels/${CHANNEL_ID}/messages`;
    let lastProcessedId = null;

    // 2. Lấy tin nhắn cuối
    try {
        const init = await axios.get(url, { headers, params: { limit: 1 } });
        if (init.data.length > 0) lastProcessedId = init.data[0].id;
    } catch (e) {}

    console.log(`>>> Worker đang trực tại kênh: ${CHANNEL_ID}`);

    // 3. Vòng lặp vô tận
    while (true) {
        try {
            const res = await axios.get(url, { headers, params: { limit: 1 } });
            
            if (res.data.length > 0) {
                const msg = res.data[0];
                
                // Nếu tin mới + Không phải của mình
                if (msg.id !== lastProcessedId && msg.author.id !== myId) {
                    lastProcessedId = msg.id;
                    console.log(`\n[Khách]: ${msg.content}`);
                    
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
            if (e.response && e.response.status === 429) {
                console.log("Rate Limit! Nghỉ 10s...");
                await sleep(10000);
            }
        }
        await sleep(2000); // Check 2s/lần
    }
}

main();
