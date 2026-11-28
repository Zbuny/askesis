// Firebase Auth отдаёт код вида "auth/wrong-password" в err.code — переводим
// самые частые в понятный текст, остальное показываем как есть (err.message).
const MESSAGES = {
  'auth/invalid-email': 'Некорректный email',
  'auth/user-not-found': 'Пользователь с таким email не найден',
  'auth/wrong-password': 'Неверный пароль',
  'auth/invalid-credential': 'Неверный email или пароль',
  'auth/email-already-in-use': 'Этот email уже зарегистрирован',
  'auth/weak-password': 'Пароль слишком короткий — минимум 6 символов',
  'auth/too-many-requests': 'Слишком много попыток — подождите немного и попробуйте снова',
  'auth/popup-closed-by-user': 'Окно входа через Google было закрыто',
  'auth/network-request-failed': 'Нет соединения с сервером — проверьте интернет',
  'auth/user-disabled': 'Этот аккаунт заблокирован',
  // Firestore отдаёт тот же код и на чтение чужого документа, и на чтение
  // несуществующего (см. getOne в api/firestore.js) — без этой записи сюда
  // долетал бы сырой английский текст "Missing or insufficient permissions."
  'permission-denied': 'Нет доступа к этой записи',
}

export function friendlyErrorMessage(err) {
  if (!err) return 'Неизвестная ошибка'
  return MESSAGES[err.code] || err.message || 'Неизвестная ошибка'
}
