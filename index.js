// ==================== FILE: index.js ====================
const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Events, REST, Routes } = require('discord.js');
const { spawn } = require('child_process');
const express = require('express'); 

// ================= CẤU HÌNH BOT CHÍNH =================
const TOKEN_BOT_MAIN = 'TOKEN_BOT_CUA_BAN'; // <--- Thay Token Bot Developer
const CLIENT_ID = 'ID_BOT_CUA_BAN';         // <--- Thay ID Bot Developer

// --- PHẦN QUAN TRỌNG: SERVER ẢO (ĐỂ TREO 24/24) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot Manager đang chạy 24/24! Đừng tắt tab này nếu chạy local.');
});

app.listen(PORT, () => {
    console.log(`🌐 Server ảo đang chạy tại port ${PORT}`);
});

// --- PHẦN BOT DISCORD ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const runningProcesses = new Map();

// Đăng ký lệnh /token
const commands = [{ name: 'token', description: 'Cấu hình Auto Chat' }];
const rest = new REST({ version: '10' }).setToken(TOKEN_BOT_MAIN);

(async () => {
    try { 
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); 
        console.log('✅ Đã đăng ký lệnh /token'); 
    } catch (e) { console.error(e); }
})();

client.on(Events.InteractionCreate, async interaction => {
    // 1. Hiện Modal
    if (interaction.isChatInputCommand() && interaction.commandName === 'token') {
        const modal = new ModalBuilder().setCustomId('setupBotModal').setTitle('Cấu hình Bot');
        
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

    // 2. Xử lý Gửi -> Chạy luôn
    if (interaction.isModalSubmit() && interaction.customId === 'setupBotModal') {
        const userToken = interaction.fields.getTextInputValue('tokenIn').trim();
        const targetChannel = interaction.fields.getTextInputValue('channelIn').trim();
        const userKey = interaction.fields.getTextInputValue('keyIn').trim();

        // Kill process cũ nếu trùng kênh
        if (runningProcesses.has(targetChannel)) {
            try {
                process.kill(runningProcesses.get(targetChannel).pid);
                runningProcesses.delete(targetChannel);
            } catch (e) {}
        }

        console.log(`>>> [NEW] Kích hoạt Worker cho kênh: ${targetChannel}`);

        // Spawn Worker
        const worker = spawn('node', ['worker.js', userToken, targetChannel, userKey]);
        runningProcesses.set(targetChannel, worker);

        worker.stdout.on('data', (data) => console.log(`[Worker ${targetChannel}]: ${data}`));
        worker.stderr.on('data', (data) => console.error(`[Lỗi Worker]: ${data}`));
        worker.on('close', () => runningProcesses.delete(targetChannel));

        await interaction.reply({ 
            content: `✅ **Đã treo thành công!**\n- Kênh: ${targetChannel}\nBot đang chạy ngầm 24/24.`, 
            ephemeral: true 
        });
    }
});

client.login(TOKEN_BOT_MAIN);
