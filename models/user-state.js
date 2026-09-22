const waitingForAccessCode = new Set();

export function startWaitingForAccessCode(user_id) {
    waitingForAccessCode.add(user_id);
    console.log(`Пользователь ${user_id}: Ожидание кода доступа`);
}
export function stopWaitigForAccessCode(user_id) {
    waitingForAccessCode.delete(user_id);
    console.log(`Пользователь ${user_id}: Ожидание кода доступа - Выход`);
}
export function isWaintigForAccessCode(user_id) {
    console.log(`Пользователь ${user_id}: Ожидание кода доступа - Проверка - ${waitingForAccessCode.has(user_id)}`);
    return waitingForAccessCode.has(user_id);
}