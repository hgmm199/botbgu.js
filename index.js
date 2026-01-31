// index.js
const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, Events, REST, Routes } = require('discord.js');
const { spawn } = require('child_process');

// ================= CẤU HÌNH BOT CHÍNH =================
const TOKEN_BOT_MAIN = 'TOKEN_BOT_CUA_BAN'; // <--- Thay Token Bot Developer
const CLIENT_ID = 'ID_BOT_CUA_BAN';         // <--- Thay ID Bot Developer

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const runningProcesses = new Map();

const commands = [{ name: 'token', description: 'Kích hoạt Auto Chat' }];
const rest = new REST({ version: '10' }).setToken(TOKEN_BOT_MAIN);
(async () => {
    try { await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); console.log('✅ Đã đăng ký lệnh /token'); } 
    catch (e) { console.error(e); }
})();

client.on(Events.InteractionCreate, async interaction => {
    // 1. Hiện Modal nhập liệu (3 ô)
    if (interaction.isChatInputCommand() && interaction.commandName === 'token') {
        const modal = new ModalBuilder().setCustomId('autoChatModal').setTitle('Cấu hình Bot Groq');
        
        // Ô 1: User Token
        const tokenInput = new TextInputBuilder()
            .setCustomId('tokenIn')
            .setLabel("User Token Discord")
            .setPlaceholder("Token tài khoản dùng để chat...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        // Ô 2: ID Kênh
        const channelInput = new TextInputBuilder()
            .setCustomId('channelIn')
            .setLabel("ID Kênh Discord")
            .setPlaceholder("Ví dụ: 123456789...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Ô 3: GROQ API KEY (MỚI THÊM)
        const keyInput = new TextInputBuilder()
            .setCustomId('keyIn')
            .setLabel("Groq API Key")
            .setPlaceholder("gsk_...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        // Add 3 ô vào 3 hàng riêng biệt
        modal.addComponents(
            new ActionRowBuilder().addComponents(tokenInput), 
            new ActionRowBuilder().addComponents(channelInput),
            new ActionRowBuilder().addComponents(keyInput)
        );
        
        await interaction.showModal(modal);
    }

    // 2. Xử lý khi bấm nút "Gửi"
    if (interaction.isModalSubmit() && interaction.customId === 'autoChatModal') {
        // Lấy dữ liệu từ 3 ô
        const userToken = interaction.fields.getTextInputValue('tokenIn').trim();
        const targetChannelId = interaction.fields.getTextInputValue('channelIn').trim();
        const userKey = interaction.fields.getTextInputValue('keyIn').trim(); // <--- Lấy Key

        // Tắt bot cũ nếu trùng kênh
        if (runningProcesses.has(targetChannelId)) {
            const oldProcess = runningProcesses.get(targetChannelId);
            oldProcess.kill(); 
            runningProcesses.delete(targetChannelId);
        }

        console.log(`>>> KÍCH HOẠT WORKER CHO KÊNH: ${targetChannelId}`);

        // --- Truyền cả 3 biến sang worker ---
        // node worker.js "token" "channel" "key"
        const worker = spawn('node', ['worker.js', userToken, targetChannelId, userKey]);

        runningProcesses.set(targetChannelId, worker);

        worker.stdout.on('data', (data) => console.log(`[Worker ${targetChannelId}]: ${data}`));
        worker.stderr.on('data', (data) => console.error(`[Worker Lỗi]: ${data}`));
        worker.on('close', () => runningProcesses.delete(targetChannelId));

        await interaction.reply({ 
            content: `✅ **Đã kích hoạt!**\n- Kênh: \`${targetChannelId}\`\n- Key: Đã cập nhật.\nBot đang chạy ngầm...`, 
            ephemeral: true 
        });
    }
});

client.login(TOKEN_BOT_MAIN);
