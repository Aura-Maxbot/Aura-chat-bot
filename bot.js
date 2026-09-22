import { Bot } from '@maxhub/max-bot-api';
import 'dotenv/config';
import {
    startWaitingForAccessCode,
    stopWaitigAccessCode,
    isWaintigAccessCode
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
    ctx.reply('Новое сообщение')
    console.log(`Пользователь ${ctx.user.user_id} написал сообщение`);
})

// Запуск бота
bot.start();
console.log('Бот запущен');
