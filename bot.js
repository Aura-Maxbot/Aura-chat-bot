import { Bot } from '@maxhub/max-bot-api';
import 'dotenv/config';
import {
    startWaitingForAccessCode,
    stopWaitigForAccessCode,
    isWaintigForAccessCode
} from './models/user-state.js'

const bot = new Bot(process.env.BOT_TOKEN);

// Обработчик команды /start
bot.command('start', (ctx) => {
    const user = ctx.user;
    console.log(`Пользователь ${user.user_id} запустил бота`);

    // TODO: Добавить пользователя в БД с ролью Неизвестен

    // Переводим польхзователя в режим ожидания кода
    startWaitingForAccessCode(user.user_id);
    
    ctx.reply('Добро пожаловать! Введите код доступа');
})

// Обработчик для любого другого сообщения
bot.on('message_created', (ctx) => {
    const user = ctx.user;
    const message = ctx.message;

    // КОД ДОСТУПА
    if (isWaintigForAccessCode(user.user_id)) {
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
