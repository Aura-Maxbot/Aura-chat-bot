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

// Админ УК
export const adminKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('Добавить сотрудника', 'add_staff')],
    [Keyboard.button.callback('Список сотрудников', 'list_staff')],
    [Keyboard.button.callback('Добавить дом', 'add_building')]
]);

// Главное меню жителя
export const residentKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('Отправить заявку в УК', 'create_request')],
    [Keyboard.button.callback('Мои заявки', 'my_requests')]
]);

// Подача заявки: выбор сотрудника. items: [{ id, label }]
export function staffChoiceKeyboard(items) {
    const rows = items.map(({ id, label }) => [
        Keyboard.button.callback(label, `req_staff:${id}`)
    ]);
    rows.push([Keyboard.button.callback('Отмена', 'req_cancel')]);
    return Keyboard.inlineKeyboard(rows);
}

// Подача заявки: шаг описания
export const requestCancelKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('Отмена', 'req_cancel')]
]);

// Подача заявки: шаг фото
export const requestPhotoKeyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback('Пропустить', 'req_skip_photo')],
    [Keyboard.button.callback('Отмена', 'req_cancel')]
]);

// Подача заявки: превью
export const requestPreviewKeyboard = Keyboard.inlineKeyboard([
    [
        Keyboard.button.callback('Отправить', 'req_send'),
        Keyboard.button.callback('Отмена', 'req_cancel')
    ]
]);

// Кнопка сотрудника под заявкой
export function replyKeyboard(requestId) {
    return Keyboard.inlineKeyboard([
        [Keyboard.button.callback('Ответить', `reply:${requestId}`)]
    ]);
}