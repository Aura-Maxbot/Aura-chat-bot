const waitingForAccessCode = new Set();

export function startWaitingForAccessCode(user_id) {
    waitingForAccessCode.add(user_id);
    console.log(`Пользователь ${user_id}: Ожидание кода доступа`);
}
export function stopWaitigAccessCode(user_id) {
    waitingForAccessCode.delete(user_id);
    console.log(`Пользователь ${user_id}: Ожидание кода доступа - Выход`);
}
export function isWaintigAccessCode(user_id) {
    waitingForAccessCode.has(user_id);
    console.log(`Пользователь ${user_id}: Ожидание кода доступа - Проверка`);
}