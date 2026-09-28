import { Keyboard } from '@maxhub/max-bot-api';


export const staffVerificationKeyboard = Keyboard.inlineKeyboard([
    [
        Keyboard.button.requestContact('Я сотрудник УК')
    ]
]);

export const cabinetKeyboard = Keyboard.inlineKeyboard([
    [
        Keyboard.button.openApp(
            'Войти в личный кабинет',
            't53_hakaton_max_bot'  
        )
    ]
]);
