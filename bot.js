import { Bot } from '@maxhub/max-bot-api';
import 'dotenv/config';
import {
    startWaitingForAccessCode,
    stopWaitigForAccessCode,
    isWaintigForAccessCode
} from './models/user-state.js'
import { staffVerificationKeyboard } from './models/keyboard.js'

const bot = new Bot(process.env.BOT_TOKEN);

// Обработчик запуска бота
bot.on('bot_started', async (ctx) => {
    const user = ctx.user;
    console.log(`Пользователь ${user.user_id} запустил бота`);

    // TODO: Добавить пользователя в БД с ролью Неизвестен

    // Переводим польхзователя в режим ожидания кода
    startWaitingForAccessCode(user.user_id);
    
    ctx.reply('Добро пожаловать! Введите код доступа', {
    attachments: [staffVerificationKeyboard]
    });
})

// Обработчик для любого другого сообщения
bot.on('message_created', async (ctx) => {
    const user = ctx.user;
    const message = ctx.message;

    // КОД ДОСТУПА
    if (isWaintigForAccessCode(user.user_id)) {
        
        // Проверяем, пришёл ли контакт
    const contact = message?.body?.attachments?.find(
        attachment => attachment.type === 'contact'
    );

    if (contact) {
        const vcfInfo = contact.payload?.vcf_info;
        const phone = vcfInfo?.match(/TEL[^:]*:([^\r\n]+)/)?.[1];
        console.log('Номер телефона:', phone);

        // TODO: проверить контакт

        ctx.reply('Контакт получен. Выполняется проверка...');
        return;
    }

        const text = message?.body?.text?.trim();

        // Пустое сообщение
        if (!text) {
            ctx.reply("Введите код доступа");
            return;
        }

        // Выход
        if (text === '/return') {
            stopWaitigForAccessCode(user.user_id);
            ctx.reply("Чтобы начать работу, введите /start");
            return;
        }

        // Проверка кода
        // TODO: Сделать проверку кода
        ctx.reply("Выполняется проверка кода доступа...")
    }

    else {
        ctx.reply('Новое сообщение')
        console.log(`Пользователь ${ctx.user.user_id} написал сообщение: ${message.body.text}`);
        return;
    }
})

// Запуск бота
bot.start();
console.log('Бот запущен');
