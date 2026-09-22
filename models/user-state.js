const waitingForAccessCode = new Set();

export function startWaitingForAccessCode(user_id) {
    waitingForAccessCode.add(user_id);
}
export function stopWaitigAccessCode(user_id) {
    waitingForAccessCode.delete(user_id);
}
export function isWaintigAccessCode(user_id) {
    waitingForAccessCode.has(user_id);
}