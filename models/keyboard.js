import { Keyboard } from '@maxhub/max-bot-api';


export const staffVerificationKeyboard = Keyboard.inlineKeyboard([
    [
        Keyboard.button.requestContact('Я сотрудник УК')
    ]
]);