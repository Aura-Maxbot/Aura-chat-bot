import { Bot } from '@maxhub/max-bot-api';
import fs from 'fs';
import path from 'path';
import os from 'os';
import 'dotenv/config';
import {
    staffVerificationKeyboard,
    adminKeyboard,
    residentKeyboard,
    staffChoiceKeyboard,
    requestCancelKeyboard,
    requestPhotoKeyboard,
    requestPreviewKeyboard,
    replyKeyboard
} from './models/keyboard.js';

// Создание бота
const bot = new Bot(process.env.BOT_TOKEN);
const API_URL = process.env.API_URL;

// Состояния пользователя
const waitingForAccessCode = new Set();

// Диалог добавления сотрудника: user_id -> { step: 'role' | 'phone', role }
const addStaffState = new Map();

// Лимит длины одного сообщения с запасом
const MAX_MESSAGE_LENGTH = 3500;

// Роль из БД -> отображаемое название
function roleLabel(role) {
    return role === 'admin' ? 'Председатель' : role;
}

// Делит строки на части, чтобы не превысить лимит длины сообщения
function chunkLines(lines, limit = MAX_MESSAGE_LENGTH) {
    const chunks = [];
    let current = '';
    for (const line of lines) {
        if (current && current.length + line.length + 1 > limit) {
            chunks.push(current);
            current = '';
        }
        current += (current ? '\n' : '') + line;
    }
    if (current) chunks.push(current);
    return chunks;
}

// Диалог добавления дома: user_id -> { step: 'address' | 'apartments' | 'floors' | 'processing', address, apartments }
const addBuildingState = new Map();

// Ограничения должны совпадать с building_logic.py
const MAX_ADDRESS_LENGTH = 500;
const MAX_APARTMENTS = 2000;
const MAX_FLOORS = 100;

// Разбирает целое число в диапазоне, иначе возвращает null
function parseIntInRange(text, min, max) {
    if (!/^\d+$/.test(text)) return null;
    const value = Number(text);
    return value >= min && value <= max ? value : null;
}

// Повторяет отправку, пока MAX обрабатывает загруженный файл (attachment.not.ready)
async function sendWithRetry(sendFn, tries = 6) {
    for (let i = 0; i < tries; i++) {
        try {
            return await sendFn();
        } catch (err) {
            const text = [err?.message, err?.code, err?.error].filter(Boolean).join(' ');
            const notReady = text.includes('not.ready') || text.includes('not.processed');
            if (!notReady || i === tries - 1) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Скачивает Excel с кодами квартир с бэкенда и отправляет админу
async function sendCodesFile(ctx, buildingId, adminId, caption) {
    const res = await fetch(`${API_URL}/api/building/${buildingId}/codes-xlsx?admin_max_id=${adminId}`);
    if (!res.ok) throw new Error(`Не удалось получить таблицу: HTTP ${res.status}`);

    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aura-'));
    const filePath = path.join(dir, `codes_house_${buildingId}.xlsx`);

    try {
        await fs.promises.writeFile(filePath, Buffer.from(await res.arrayBuffer()));
        const file = await ctx.api.uploadFile({ source: filePath });
        await sendWithRetry(() =>
            ctx.reply(caption, { attachments: [file.toJson(), adminKeyboard] })
        );
    } finally {
        await fs.promises.rm(dir, { recursive: true, force: true });
    }
}

// Подача заявки жителем: user_id -> { step, recipients, staffId, staffLabel, description, photo }
// step: 'staff' | 'description' | 'photo' | 'preview' | 'sending'
const requestState = new Map();

// Ответ сотрудника на заявку: MAX ID сотрудника -> { requestId }
const replyState = new Map();

// Ограничения должны совпадать с request_logic.py
const MAX_REQUEST_DESCRIPTION = 2000;
const MAX_ANSWER_LENGTH = 3000;

// Сбрасывает все незаконченные диалоги пользователя
function resetDialogs(userId) {
    addStaffState.delete(userId);
    addBuildingState.delete(userId);
    requestState.delete(userId);
    replyState.delete(userId);
}

// ID пользователя из любого контекста (сообщение или нажатие кнопки)
function getUserId(ctx) {
    return (ctx.user ?? ctx.callback?.user ?? ctx.update?.callback?.user)?.user_id;
}

// Payload нажатой callback-кнопки
function getPayload(ctx) {
    return ctx.callback?.payload ?? ctx.update?.callback?.payload ?? ctx.match?.[0] ?? '';
}

function shorten(text, limit) {
    return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

// Подпись кнопки выбора сотрудника: «Сантехник - Иван»
function staffButtonLabel(staff) {
    const name = (staff.full_name || '').trim();
    return shorten(name ? `${roleLabel(staff.role)} - ${name}` : roleLabel(staff.role), 100);
}

// Отправка сообщения пользователю по его MAX ID. Если фото не прикрепилось, шлём без него
async function sendToUser(userId, text, { photo = null, keyboard = null } = {}) {
    const attachments = [];
    if (photo) attachments.push({ type: 'image', payload: { token: photo } });
    if (keyboard) attachments.push(keyboard);

    try {
        await bot.api.sendMessageToUser(userId, text, attachments.length ? { attachments } : undefined);
        return true;
    } catch (err) {
        console.error(`Не удалось отправить сообщение пользователю ${userId}:`, err);
        if (!photo) return false;
    }

    // Повторяем без фото
    try {
        await bot.api.sendMessageToUser(
            userId,
            `${text}\n\n(К заявке было приложено фото, но отправить его не удалось.)`,
            keyboard ? { attachments: [keyboard] } : undefined
        );
        return true;
    } catch (err) {
        console.error(`Не удалось отправить сообщение пользователю ${userId} (без фото):`, err);
        return false;
    }
}

// Превью заявки перед отправкой
async function showRequestPreview(ctx, state) {
    state.step = 'preview';
    await ctx.reply(
        `Проверьте заявку:\n\n` +
        `Кому: ${state.staffLabel}\n` +
        `Описание: ${state.description}\n` +
        `Фото: ${state.photo ? '1 шт.' : 'нет'}`,
        { attachments: [requestPreviewKeyboard] }
    );
}

// Сохраняет ответ сотрудника и пересылает его жителю (и копию админам)
async function sendStaffAnswer(ctx, requestId, answer) {
    const userId = ctx.user.user_id;

    try {
        const res = await fetch(`${API_URL}/api/request/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staff_max_id: userId,
                request_id: requestId,
                answer,
            })
        });
        const data = await res.json();
        console.log('Ответ сервера (request/answer):', data);

        if (!data.ok) {
            await ctx.reply(`Не удалось отправить ответ: ${data.error || 'неизвестная ошибка'}`);
            return;
        }

        const who = [roleLabel(data.staff_role), (data.staff_name || '').trim()]
            .filter(Boolean)
            .join(' - ');

        const delivered = data.resident_max_id
            ? await sendToUser(
                data.resident_max_id,
                `Ответ на вашу заявку № ${data.request_id}\nОтвечает: ${who}\n\n${answer}`,
                { keyboard: residentKeyboard }
            )
            : false;

        // Копия админам (если отвечает не админ, они не получали ответ)
        await Promise.allSettled(data.admin_max_ids.map((adminId) =>
            sendToUser(
                adminId,
                `Ответ на заявку № ${data.request_id}\n` +
                `Отвечает: ${who}\n` +
                `Житель: ${data.resident_name || 'не указано'}\n` +
                `Адрес: ${data.address} - кв. ${data.apartment_number}\n\n${answer}`
            )
        ));

        await ctx.reply(delivered
            ? 'Ответ отправлен.'
            : 'Ответ сохранён, но доставить его жителю не удалось.');
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
    } finally {
        replyState.delete(userId);
    }
}

// Главное меню жителя: адрес дома, квартира и кнопка заявки
async function showResidentMenu(ctx, info) {
    await ctx.reply(
        `Главное меню\n${info.address} - кв. ${info.apartment_number}`,
        { attachments: [residentKeyboard] }
    );
}

// Запуск бота: житель уже привязан -> меню, иначе просим код квартиры
async function handleStart(ctx) {
    const user = ctx.user;
    console.log(`Пользователь ${user.user_id} запустил бота`);

    // Сбрасываем незаконченные диалоги
    resetDialogs(user.user_id);

    try {
        const res = await fetch(`${API_URL}/api/resident/by-max-id/${user.user_id}`);
        const data = await res.json();

        if (data.found) {
            waitingForAccessCode.delete(user.user_id);
            await showResidentMenu(ctx, data);
            return;
        }
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
        return;
    }

    // Переводим пользователя в режим ожидания кода
    waitingForAccessCode.add(user.user_id);

    await ctx.reply(
        'Добро пожаловать! Введите код квартиры, который выдала ваша управляющая компания.',
        { attachments: [staffVerificationKeyboard] }
    );
}

// Привязка жителя к квартире по введённому коду
async function bindResident(ctx, code) {
    const user = ctx.user;

    try {
        const res = await fetch(`${API_URL}/api/resident/bind`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                max_id: user.user_id,
                full_name: user.name || user.first_name || null,
            })
        });
        const data = await res.json();
        console.log('Ответ сервера (resident/bind):', data);

        if (!data.ok) {
            await ctx.reply(data.error || 'Не удалось привязать квартиру. Попробуйте позже.');
            return;
        }

        // Код не найден: остаёмся в режиме ожидания, чтобы можно было попробовать снова
        if (!data.found) {
            await ctx.reply('Код не найден. Обратитесь в УК.');
            return;
        }

        waitingForAccessCode.delete(user.user_id);
        await ctx.reply('Готово! Вы привязаны к квартире.');
        await showResidentMenu(ctx, data);
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
    }
}

// Обработчики запуска бота (кнопка «Начать» и команда /start)
bot.on('bot_started', handleStart);
bot.command('start', handleStart);

// ЗАЯВКА ЖИТЕЛЯ

// Шаг 1: «Отправить заявку в УК» -> список сотрудников УК жителя
bot.action('create_request', async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    try {
        const res = await fetch(`${API_URL}/api/request/recipients/${userId}`);
        const data = await res.json();

        if (!data.ok) {
            await ctx.reply(data.error || 'Не удалось получить список сотрудников.');
            return;
        }

        if (!data.staff.length) {
            await ctx.reply('В вашей УК пока нет доступных сотрудников.', { attachments: [residentKeyboard] });
            return;
        }

        const recipients = data.staff.map((s) => ({ id: s.staff_id, label: staffButtonLabel(s) }));

        resetDialogs(userId);
        requestState.set(userId, {
            step: 'staff',
            recipients,
            staffId: null,
            staffLabel: null,
            description: null,
            photo: null,
        });

        await ctx.reply('Кому отправить заявку?', { attachments: [staffChoiceKeyboard(recipients)] });
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
    }
});

// Шаг 2: выбран сотрудник -> просим описать проблему
bot.action(/^req_staff:(\d+)$/, async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    const state = requestState.get(userId);
    if (!state || state.step !== 'staff') {
        await ctx.reply('Заявка не найдена. Нажмите «Отправить заявку в УК», чтобы начать заново.', {
            attachments: [residentKeyboard]
        });
        return;
    }

    const staffId = Number(getPayload(ctx).split(':')[1]);
    const chosen = state.recipients.find((r) => r.id === staffId);
    if (!chosen) {
        await ctx.reply('Выберите сотрудника из списка.');
        return;
    }

    state.staffId = chosen.id;
    state.staffLabel = chosen.label;
    state.step = 'description';

    await ctx.reply(`Кому: ${chosen.label}\n\nОпишите проблему.`, { attachments: [requestCancelKeyboard] });
});

// Шаг 4: пропуск фото -> превью
bot.action('req_skip_photo', async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    const state = requestState.get(userId);
    if (!state || state.step !== 'photo') {
        await ctx.reply('Заявка не найдена. Нажмите «Отправить заявку в УК», чтобы начать заново.', {
            attachments: [residentKeyboard]
        });
        return;
    }

    await showRequestPreview(ctx, state);
});

// Отмена на любом шаге
bot.action('req_cancel', async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    if (requestState.get(userId)?.step === 'sending') return;

    requestState.delete(userId);
    await ctx.reply('Заявка отменена.', { attachments: [residentKeyboard] });
});

// Шаг 5: «Отправить» -> создаём заявку и уведомляем сотрудника
bot.action('req_send', async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    const state = requestState.get(userId);
    if (state?.step === 'sending') return; // повторное нажатие
    if (!state || state.step !== 'preview') {
        await ctx.reply('Заявка не найдена. Нажмите «Отправить заявку в УК», чтобы начать заново.', {
            attachments: [residentKeyboard]
        });
        return;
    }

    state.step = 'sending';

    try {
        const res = await fetch(`${API_URL}/api/request/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_id: userId,
                staff_id: state.staffId,
                description: state.description,
                photo: state.photo,
            })
        });
        const data = await res.json();
        console.log('Ответ сервера (request/create):', data);

        if (!data.ok) {
            await ctx.reply(
                `Не удалось отправить заявку: ${data.error || 'неизвестная ошибка'}`,
                { attachments: [residentKeyboard] }
            );
            return;
        }

        await ctx.reply(`Заявка № ${data.request_id} принята.`, { attachments: [residentKeyboard] });

        const details =
            `Кому: ${roleLabel(data.category)}\n` +
            `Житель: ${data.resident_name || 'не указано'}\n` +
            `Адрес: ${data.address} - кв. ${data.apartment_number}\n\n` +
            state.description;

        // Сотрудник, которому адресована заявка, получает её с кнопкой «Ответить»
        const delivered = await sendToUser(
            data.staff_max_id,
            `Новая заявка № ${data.request_id}\n${details}`,
            { photo: state.photo, keyboard: replyKeyboard(data.request_id) }
        );

        // Копии админам (без кнопки)
        await Promise.allSettled(data.admin_max_ids.map((adminId) =>
            sendToUser(adminId, `Копия заявки № ${data.request_id}\n${details}`, { photo: state.photo })
        ));

        if (!delivered) {
            await ctx.reply('Сотруднику пока не удалось доставить уведомление. Если ответа долго нет, обратитесь в УК.');
        }
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.', { attachments: [residentKeyboard] });
    } finally {
        requestState.delete(userId);
    }
});

// «Мои заявки»
bot.action('my_requests', async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    try {
        const res = await fetch(`${API_URL}/api/request/my/${userId}`);
        const data = await res.json();

        if (!data.ok) {
            await ctx.reply(data.error || 'Не удалось получить список заявок.');
            return;
        }

        if (!data.requests.length) {
            await ctx.reply('У вас пока нет заявок.', { attachments: [residentKeyboard] });
            return;
        }

        const lines = ['Мои заявки:', ''];
        for (const r of data.requests) {
            const date = r.created_at ? ` (${r.created_at})` : '';
            lines.push(`№ ${r.request_id} - ${roleLabel(r.category)} - ${r.status}${date}`);
            lines.push(shorten(r.description, 100));
            if (r.answer) lines.push(`Ответ: ${shorten(r.answer, 200)}`);
            lines.push('');
        }

        const chunks = chunkLines(lines);
        for (let i = 0; i < chunks.length; i++) {
            const isLast = i === chunks.length - 1;
            await ctx.reply(chunks[i], isLast ? { attachments: [residentKeyboard] } : undefined);
        }
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
    }
});

// ОТВЕТ СОТРУДНИКА: кнопка «Ответить» под заявкой
bot.action(/^reply:(\d+)$/, async (ctx) => {
    const userId = getUserId(ctx);
    if (!userId) return;

    const requestId = Number(getPayload(ctx).split(':')[1]);
    if (!requestId) return;

    resetDialogs(userId);
    replyState.set(userId, { requestId });

    await ctx.reply(`Введите ваш ответ на заявку № ${requestId}.\nДля отмены: /cancel`);
});

// Нажатие кнопки «Добавить сотрудника»
bot.action('add_staff', async (ctx) => {
    const userId = (ctx.user ?? ctx.callback?.user)?.user_id;
    if (!userId) return;

    try {
        // Роль проверяем по БД: так кнопкой не воспользуется обычный сотрудник
        const res = await fetch(`${API_URL}/api/staff/by-max-id/${userId}`);
        const data = await res.json();

        if (!data.found || data.role !== 'admin') {
            await ctx.reply('У вас нет прав для добавления сотрудников.');
            return;
        }

        resetDialogs(userId);
        addStaffState.set(userId, { step: 'role', role: null });
        await ctx.reply('Введите должность сотрудника.\nДля отмены: /cancel');
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
    }
});

// Нажатие кнопки «Добавить дом»
bot.action('add_building', async (ctx) => {
    const userId = (ctx.user ?? ctx.callback?.user)?.user_id;
    if (!userId) return;

    try {
        const res = await fetch(`${API_URL}/api/staff/by-max-id/${userId}`);
        const data = await res.json();

        if (!data.found || data.role !== 'admin') {
            await ctx.reply('У вас нет прав для добавления домов.');
            return;
        }

        resetDialogs(userId);
        addBuildingState.set(userId, { step: 'address', address: null, apartments: null });
        await ctx.reply('Введите адрес дома.\nДля отмены: /cancel');
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
    }
});

// Нажатие кнопки «Список сотрудников»
bot.action('list_staff', async (ctx) => {
    const userId = (ctx.user ?? ctx.callback?.user)?.user_id;
    if (!userId) return;

    try {
        // Права проверяются на сервере: компания берётся из записи админа
        const res = await fetch(`${API_URL}/api/staff/list/${userId}`);
        const data = await res.json();

        if (!data.ok) {
            await ctx.reply(data.error || 'Не удалось получить список сотрудников.');
            return;
        }

        if (!data.staff.length) {
            await ctx.reply('Сотрудников пока нет.', { attachments: [adminKeyboard] });
            return;
        }

        const lines = data.staff.map((s, i) => {
            const status = s.is_active ? 'приглашение принято' : 'приглашение отправлено';
            return `${i + 1}. ${roleLabel(s.role)} - ${s.phone || 'номер не указан'} - ${status}`;
        });

        const chunks = chunkLines(['Сотрудники:', '', ...lines]);
        for (let i = 0; i < chunks.length; i++) {
            const isLast = i === chunks.length - 1;
            // Клавиатуру прикрепляем только к последнему сообщению
            await ctx.reply(chunks[i], isLast ? { attachments: [adminKeyboard] } : undefined);
        }
    } catch (err) {
        console.error('Ошибка запроса к API:', err);
        await ctx.reply('Сервис временно недоступен. Попробуйте позже.');
    }
});

// Обработчик для любого другого сообщения
bot.on('message_created', async (ctx) => {
    const user = ctx.user;
    const message = ctx.message;

    // ДОБАВЛЕНИЕ СОТРУДНИКА
    const addState = addStaffState.get(user.user_id);
    if (addState) {
        const text = message?.body?.text?.trim();

        if (text === '/cancel') {
            addStaffState.delete(user.user_id);
            ctx.reply('Добавление отменено.', { attachments: [adminKeyboard] });
            return;
        }

        if (!text) {
            ctx.reply('Пожалуйста, отправьте ответ текстом.');
            return;
        }

        // Шаг 1: должность
        if (addState.step === 'role') {
            if (text.length > 50) {
                ctx.reply('Слишком длинная должность (максимум 50 символов). Введите короче.');
                return;
            }
            addState.role = text;
            addState.step = 'phone';
            ctx.reply('Введите номер телефона сотрудника, например +7 999 000-00-00.');
            return;
        }

        // Шаг 2: телефон
        if (addState.step === 'phone') {
            try {
                const res = await fetch(`${API_URL}/api/staff/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        admin_max_id: user.user_id,
                        role: addState.role,
                        phone: text,
                    })
                });
                const data = await res.json();
                console.log('Ответ сервера (staff/add):', data);

                if (data.ok) {
                    ctx.reply(
                        `Сотрудник добавлен.\n` +
                        `Должность: ${addState.role}\n` +
                        `Телефон: ${data.phone}\n\n` +
                        `Пусть он откроет бота и отправит свой контакт, тогда доступ активируется.`,
                        { attachments: [adminKeyboard] }
                    );
                    addStaffState.delete(user.user_id);
                } else if (data.error === 'Некорректный номер телефона') {
                    // Остаёмся на шаге телефона, чтобы можно было ввести номер заново
                    ctx.reply('Некорректный номер. Введите его ещё раз, например +79990000000.');
                } else {
                    ctx.reply(
                        `Не удалось добавить сотрудника: ${data.error || 'неизвестная ошибка'}`,
                        { attachments: [adminKeyboard] }
                    );
                    addStaffState.delete(user.user_id);
                }
            } catch (err) {
                console.error('Ошибка запроса к API:', err);
                ctx.reply('Сервис временно недоступен. Попробуйте позже.');
                addStaffState.delete(user.user_id);
            }
            return;
        }
    }

    // ДОБАВЛЕНИЕ ДОМА
    const buildingState = addBuildingState.get(user.user_id);
    if (buildingState) {
        if (buildingState.step === 'processing') {
            ctx.reply('Подождите, дом ещё добавляется...');
            return;
        }

        const text = message?.body?.text?.trim();

        if (text === '/cancel') {
            addBuildingState.delete(user.user_id);
            ctx.reply('Добавление дома отменено.', { attachments: [adminKeyboard] });
            return;
        }

        if (!text) {
            ctx.reply('Пожалуйста, отправьте ответ текстом.');
            return;
        }

        // Шаг 1: адрес
        if (buildingState.step === 'address') {
            if (text.length > MAX_ADDRESS_LENGTH) {
                ctx.reply(`Слишком длинный адрес (максимум ${MAX_ADDRESS_LENGTH} символов). Введите короче.`);
                return;
            }
            buildingState.address = text;
            buildingState.step = 'apartments';
            ctx.reply('Введите количество квартир в доме.');
            return;
        }

        // Шаг 2: количество квартир
        if (buildingState.step === 'apartments') {
            const apartments = parseIntInRange(text, 1, MAX_APARTMENTS);
            if (apartments === null) {
                ctx.reply(`Введите целое число квартир от 1 до ${MAX_APARTMENTS}.`);
                return;
            }
            buildingState.apartments = apartments;
            buildingState.step = 'floors';
            ctx.reply('Введите количество этажей.');
            return;
        }

        // Шаг 3: количество этажей, затем создание дома
        if (buildingState.step === 'floors') {
            const floors = parseIntInRange(text, 1, MAX_FLOORS);
            if (floors === null) {
                ctx.reply(`Введите целое число этажей от 1 до ${MAX_FLOORS}.`);
                return;
            }

            // Блокируем повторные сообщения, пока идёт создание
            buildingState.step = 'processing';
            await ctx.reply('Добавляю дом и генерирую коды квартир, это может занять несколько секунд...');

            try {
                const res = await fetch(`${API_URL}/api/building/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        admin_max_id: user.user_id,
                        address: buildingState.address,
                        apartments_count: buildingState.apartments,
                        floors_count: floors,
                    })
                });
                const data = await res.json();
                console.log('Ответ сервера (building/add):', data);

                if (!data.ok) {
                    ctx.reply(
                        `Не удалось добавить дом: ${data.error || 'неизвестная ошибка'}`,
                        { attachments: [adminKeyboard] }
                    );
                    return;
                }

                try {
                    await sendCodesFile(
                        ctx,
                        data.building_id,
                        user.user_id,
                        `Дом добавлен: ${buildingState.address}\n` +
                        `Квартир: ${data.apartments_count}, этажей: ${floors}.\n` +
                        `Таблица с кодами квартир во вложении.`
                    );
                } catch (fileErr) {
                    console.error('Ошибка отправки таблицы:', fileErr);
                    ctx.reply(
                        `Дом добавлен: ${buildingState.address}, но отправить таблицу с кодами не удалось.`,
                        { attachments: [adminKeyboard] }
                    );
                }
            } catch (err) {
                console.error('Ошибка запроса к API:', err);
                ctx.reply('Сервис временно недоступен. Попробуйте позже.');
            } finally {
                addBuildingState.delete(user.user_id);
            }
            return;
        }
    }

    // ОТВЕТ СОТРУДНИКА НА ЗАЯВКУ
    const replyDialog = replyState.get(user.user_id);
    if (replyDialog) {
        const text = message?.body?.text?.trim();

        if (text === '/cancel') {
            replyState.delete(user.user_id);
            ctx.reply('Ответ отменён.');
            return;
        }

        if (!text) {
            ctx.reply('Введите ответ текстом.');
            return;
        }

        if (text.length > MAX_ANSWER_LENGTH) {
            ctx.reply(`Слишком длинный ответ (максимум ${MAX_ANSWER_LENGTH} символов). Сократите его.`);
            return;
        }

        await sendStaffAnswer(ctx, replyDialog.requestId, text);
        return;
    }

    // ЗАЯВКА ЖИТЕЛЯ
    const reqState = requestState.get(user.user_id);
    if (reqState) {
        const text = message?.body?.text?.trim();

        if (text === '/cancel') {
            if (reqState.step !== 'sending') {
                requestState.delete(user.user_id);
                ctx.reply('Заявка отменена.', { attachments: [residentKeyboard] });
            }
            return;
        }

        if (reqState.step === 'sending') {
            ctx.reply('Подождите, заявка отправляется...');
            return;
        }

        if (reqState.step === 'staff') {
            ctx.reply('Выберите сотрудника с помощью кнопок или отправьте /cancel.');
            return;
        }

        // Шаг 3: описание проблемы
        if (reqState.step === 'description') {
            if (!text) {
                ctx.reply('Опишите проблему текстом.');
                return;
            }
            if (text.length > MAX_REQUEST_DESCRIPTION) {
                ctx.reply(`Слишком длинное описание (максимум ${MAX_REQUEST_DESCRIPTION} символов). Сократите его.`);
                return;
            }
            reqState.description = text;
            reqState.step = 'photo';
            ctx.reply(
                'Хотите прикрепить фото? Отправьте фото или нажмите «Пропустить».',
                { attachments: [requestPhotoKeyboard] }
            );
            return;
        }

        // Шаг 4: фото (необязательно)
        if (reqState.step === 'photo') {
            const image = message?.body?.attachments?.find((a) => a.type === 'image');
            if (!image) {
                ctx.reply('Отправьте фото или нажмите «Пропустить».');
                return;
            }
            const token = image.payload?.token;
            if (!token) {
                ctx.reply('Не удалось обработать фото. Отправьте другое или нажмите «Пропустить».');
                return;
            }
            reqState.photo = token;
            await showRequestPreview(ctx, reqState);
            return;
        }

        if (reqState.step === 'preview') {
            ctx.reply('Нажмите «Отправить» или «Отмена».');
            return;
        }
    }

    // КОД ДОСТУПА
    if (waitingForAccessCode.has(user.user_id)) {

        // Проверяем, пришёл ли контакт
        const contact = message?.body?.attachments?.find(
            attachment => attachment.type === 'contact'
        );

        if (contact) {
            const vcfInfo = contact.payload?.vcf_info;
            const phone = vcfInfo?.match(/TEL[^:]*:([^\r\n]+)/)?.[1];
            console.log('Номер телефона:', phone);

            if (!phone) {
                ctx.reply('Не удалось определить номер телефона. Попробуйте ещё раз.');
                return;
            }

            try {
                // 1. Пробуем как админа компании
                const response = await fetch(`${API_URL}/api/company/check-phone-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone,
                        max_id: user.user_id,
                        full_name: user.name || user.first_name || null,
                    })
                });
                const data = await response.json();
                console.log('Ответ сервера (admin):', data);

                if (data.exists) {
                    ctx.reply(
                        `Вы успешно авторизованы!\n` +
                        `Ваша компания: ${data.company_name}\n` +
                        `Ваша должность: Председатель`,
                        { attachments: [adminKeyboard] }
                    );
                    waitingForAccessCode.delete(user.user_id);
                    return;
                }

                // 2. Если не админ — пробуем как сотрудника
                const staffResponse = await fetch(`${API_URL}/api/staff/check-phone`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone,
                        max_id: user.user_id,
                        full_name: user.name || user.first_name || null,
                    })
                });
                const staffData = await staffResponse.json();
                console.log('Ответ сервера (staff):', staffData);

                if (staffData.exists) {
                    ctx.reply(
                        `Вы успешно авторизованы!\n` +
                        `Ваша компания: ${staffData.company_name}\n` +
                        `Ваша должность: ${staffData.role}`
                    );
                    waitingForAccessCode.delete(user.user_id);
                } else {
                    ctx.reply('Номер не найден. Обратитесь в вашу управляющую компанию.');
                }
            } catch (err) {
                console.error('Ошибка запроса к API:', err);
                ctx.reply('Сервис временно недоступен. Попробуйте позже.');
            }

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
            waitingForAccessCode.delete(user.user_id);
            ctx.reply("Чтобы начать работу, введите /start");
            return;
        }

        // Проверка кода квартиры
        await bindResident(ctx, text);
    } else {
        ctx.reply('Новое сообщение');
        console.log(`Пользователь ${ctx.user.user_id} написал сообщение: ${message.body.text}`);
        return;
    }
});

// Запуск бота
bot.start();
console.log('Бот запущен');