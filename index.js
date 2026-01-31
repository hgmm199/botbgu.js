// ==================== FILE: index.js ====================
require('dotenv').config(); // Đọc biến môi trường
const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Events, REST, Routes } = require('discord.js');
const { spawn } = require('child_process');
const express = require('express');

// ================= CẤU HÌNH TỰ ĐỘNG (TỪ RENDER) =================
// Code sẽ tự lấy ID 1421008624817279106 từ phần Environment của Render
const TOKEN_BOT_MAIN = process.env.TOKEN_BOT_MAIN;
const CLIENT_ID = process.env.CLIENT_ID;

// Kiểm tra xem đã nhập đủ thông tin trên Render chưa
if (!TOKEN_BOT_MAIN || !CLIENT_ID) {
    console.error("❌ LỖI: Thiếu TOKEN_BOT_MAIN hoặc CLIENT_ID trong phần Environment của Render!");
    // Không exit để giữ server ảo chạy, giúp bạn vào web xem lỗi
}

// --- 1. SERVER ẢO (GIỮ BOT SỐNG 24/24) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    if (!CLIENT_ID) return res.send('❌ LỖI: Chưa nhập CLIENT_ID vào Render!');
    if (!TOKEN_BOT_MAIN) return res.send('❌ LỖI: Chưa nhập TOKEN_BOT_MAIN vào Render!');
    
    res.send(`✅ Bot đang chạy ổn định! (Client ID: ${CLIENT_ID})`);
});

app.listen(PORT, () => {
    console.log(`🌐 Server ảo đang chạy tại port ${PORT}`);
});

// --- 2. BOT DISCORD ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const runningProcesses = new Map(); // Quản lý các worker

const commands = [{ name: 'token', description: 'Cấu hình Auto Chat' }];

// Đăng ký lệnh Slash Command
if (TOKEN_BOT_MAIN && CLIENT_ID) {
    const rest = new REST({ version: '10' }).setToken(TOKEN_BOT_MAIN);
    (async () => {
        try { 
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); 
            console.log('✅ Đã đăng ký lệnh /token thành công'); 
        } catch (e) { console.error('Lỗi đăng ký lệnh:', e); }
    })();
}

client.on(Events.InteractionCreate, async interaction => {
    // A. HIỆN BẢNG NHẬP (MODAL)
    if (interaction.isChatInputCommand() && interaction.commandName === 'token') {
        const modal = new ModalBuilder().setCustomId('setupBotModal').setTitle('Cấu hình Bot Auto');
        
        const tokenInput = new TextInputBuilder().setCustomId('tokenIn').setLabel("User Token").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const channelInput = new TextInputBuilder().setCustomId('channelIn').setLabel("ID Kênh").setStyle(TextInputStyle.Short).setRequired(true);
        const keyInput = new TextInputBuilder().setCustomId('keyIn').setLabel("Groq API Key").setStyle(TextInputStyle.Short).setRequired(true);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(tokenInput), 
            new ActionRowBuilder().addComponents(channelInput),
            new ActionRowBuilder().addComponents(keyInput)
        );
        
        await interaction.showModal(modal);
    }

    // B. XỬ LÝ KHI BẤM GỬI -> CHẠY WORKER
    if (interaction.isModalSubmit() && interaction.customId === 'setupBotModal') {
        const userToken = interaction.fields.getTextInputValue('tokenIn').trim();
        const targetChannel = interaction.fields.getTextInputValue('channelIn').trim();
        const userKey = interaction.fields.getTextInputValue('keyIn').trim();

        // Tắt bot cũ nếu trùng kênh
        if (runningProcesses.has(targetChannel)) {
            try {
                process.kill(runningProcesses.get(targetChannel).pid);
                runningProcesses.delete(targetChannel);
            } catch (e) {}
        }

        console.log(`>>> [CMD] Kích hoạt Worker cho kênh: ${targetChannel}`);

        // Chạy file worker.js ngầm
        const worker = spawn('node', ['worker.js', userToken, targetChannel, userKey]);
        runningProcesses.set(targetChannel, worker);

        worker.stdout.on('data', (data) => console.log(`[Worker ${targetChannel}]: ${data}`));
        worker.stderr.on('data', (data) => console.error(`[Lỗi Worker]: ${data}`));
        worker.on('close', () => runningProcesses.delete(targetChannel));

        await interaction.reply({ 
            content: `✅ **Kích hoạt thành công!**\n- Kênh: ${targetChannel}\nBot đang chạy ngầm trên Server.`, 
            ephemeral: true 
        });
    }
});

if (TOKEN_BOT_MAIN) {
    client.login(TOKEN_BOT_MAIN).catch(e => console.error("Lỗi Login Bot Quản Lý:", e));
}
