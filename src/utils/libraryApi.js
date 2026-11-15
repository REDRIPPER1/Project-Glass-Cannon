const PROFILE_STORAGE_KEY = 'litlab.api-profile.v1';

function storage() { try { return globalThis.window?.localStorage; } catch { return null; } }

export function displayDifficulty(label, rating) {
  if (!label || /grades?\s*\d/i.test(label)) return ['Starter', 'Explorer', 'Pathfinder', 'Trailblazer', 'Legend'][Math.max(0, Math.min(4, Math.round((rating || 1) - 1)))];
  return label;
}

export function normalizeApiBook(book) {
  const rating = Math.max(1, Math.min(5, Math.round(Number(book.starRating) || Number(book.difficulty) || 1)));
  const mode = book.access?.state || book.accessRules?.mode || book.accessTier;
  const freeChapterIds = new Set(book.accessRules?.freeChapterIds || []);
  return {
    ...book,
    category: book.category || book.topic || 'Classics',
    difficulty: rating,
    difficultyLabel: displayDifficulty(book.difficultyLabel, rating),
    accessTier: mode === 'owned' ? 'owned' : mode === 'purchase-only' ? 'purchase-only' : mode === 'subscription' || mode === 'premium' ? 'premium' : 'free-demo',
    priceDiamonds: Number(book.access?.priceDiamonds ?? book.priceDiamonds ?? 0) || 0,
    requiredAttribution: book.rights?.requiredAttribution || book.requiredAttribution,
    license: book.rights?.license || book.license,
    contentAvailability: book.contentAvailability || 'unavailable',
    chapterMetadata: (book.chapterMetadata || []).map((chapter, index) => ({
      ...chapter,
      accessTier: chapter.access?.state || chapter.accessTier || (freeChapterIds.has(chapter.id) ? 'free-demo' : 'premium'),
      contentAvailability: chapter.contentAvailability || 'unavailable',
      readingLevels: (chapter.readingLevels || [{ id: `${chapter.id || index + 1}-level`, label: `Level ${index + 1}`, access: chapter.access?.state || chapter.accessTier || (freeChapterIds.has(chapter.id) ? 'free' : 'premium') }]).map((level) => ({ ...level, accessTier: level.accessTier || level.access || 'free' })),
    })),
  };
}

export async function api(path, options) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail?.code || `api_${response.status}`);
  }
  return response.json();
}

export async function loadBookCatalog() {
  const books = await api('/api/catalog/books');
  return Array.isArray(books) ? books.map(normalizeApiBook) : [];
}

export async function loadBookQuizzes() {
  const quizzes = await api('/api/catalog/book-quizzes');
  return Array.isArray(quizzes) ? quizzes : [];
}

export async function ensureAnonymousProfile() {
  const savedId = storage()?.getItem(PROFILE_STORAGE_KEY);
  if (savedId) {
    try { await api(`/api/profiles/${savedId}`); return savedId; } catch { storage()?.removeItem(PROFILE_STORAGE_KEY); }
  }
  const profile = await api('/api/profiles', { method: 'POST', body: JSON.stringify({ displayName: 'Trail Reader', demoPlan: 'free' }) });
  storage()?.setItem(PROFILE_STORAGE_KEY, profile.id);
  return profile.id;
}

export async function loadLibraryEnhancement() {
  const [books, profileId, bookQuizzes] = await Promise.all([loadBookCatalog(), ensureAnonymousProfile(), loadBookQuizzes()]);
  const [library, recommendations, balances, pets, shopItems, profile, bookWishlist] = await Promise.all([
    api(`/api/profiles/${profileId}/library`),
    api(`/api/profiles/${profileId}/recommendations`),
    api(`/api/profiles/${profileId}/currencies`),
    api('/api/catalog/pets'),
    api('/api/catalog/shop'),
    api(`/api/profiles/${profileId}`),
    api(`/api/profiles/${profileId}/book-wishlist`),
  ]);
  return { books, profileId, bookQuizzes, bookWishlistIds: Array.isArray(bookWishlist?.bookWishlistIds) ? bookWishlist.bookWishlistIds : [], library: Array.isArray(library) ? library : [], recommendations: Array.isArray(recommendations) ? recommendations : [], wallet: balances?.wallet, inventory: balances?.inventory, pets: Array.isArray(pets) ? pets : [], shopItems: Array.isArray(shopItems) ? shopItems : [], profile };
}

export async function loadChapterReference(profileId, bookId, chapterId) {
  return api(`/api/profiles/${profileId}/books/${bookId}/chapters/${chapterId}`);
}

export async function loadBookQuiz(profileId, bookId, quizId) {
  return api(`/api/profiles/${profileId}/books/${bookId}/quizzes/${quizId}`);
}

export async function redeemWishlistPagesRemote(profileId) {
  return api(`/api/profiles/${profileId}/wishlist/redemptions`, { method: 'POST' });
}

export async function purchaseShopItem(profileId, shopItemId) {
  return api(`/api/profiles/${profileId}/purchases`, { method: 'POST', body: JSON.stringify({ shopItemId }) });
}

export async function setRemoteBookWishlist(profileId, bookId, wishlisted) {
  return api(`/api/profiles/${profileId}/book-wishlist/${bookId}`, { method: wishlisted ? 'PUT' : 'DELETE' });
}
