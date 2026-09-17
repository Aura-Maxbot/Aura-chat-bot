import 'dotenv/config';
import { Bot } from '@maxhub/max-bot-api';

const bot = new Bot(process.env.BOT_TOKEN);

// Обработчик команды /start
bot.command('start', (ctx) => ctx.reply('Добро пожаловать!'));

// Обработчик для любого другого сообщения
bot.on('message_created', (ctx) => ctx.reply('Новое сообщение'));

// Запуск бота
bot.start();