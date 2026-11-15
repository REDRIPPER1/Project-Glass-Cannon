const PROFILE_STORAGE_KEY = 'litlab.api-profile.v1';

function storage() { try { return globalThis.window?.localStorage; } catch { return null; } }

export function displayDifficulty(label, rating) {
  if (!label || /grades?\s*\d/i.test(label)) return ['Starter', 'Explorer', 'Pathfinder', 'Trailblazer', 'Legend'][Math.max(0, Math.min(4, Math.round((rating || 1) - 1)))];
  return label;
}

export function normalizeApiBook(book) {
  const rating = Math.max(1, Math.min(5, Math.round(Number(book.starRating) || Number(book.difficulty) || 1)));
  const mode = book.accessRules?.mode || book.accessTier;
  const freeChapterIds = new Set(book.accessRules?.freeChapterIds || []);
  return {
    ...book,
    category: book.category || book.topic || 'Classics',
    difficulty: rating,
    difficultyLabel: displayDifficulty(book.difficultyLabel, rating),
    accessTier: mode === 'purchase-only' ? 'purchase-only' : mode === 'subscription' || mode === 'premium' ? 'premium' : 'free-demo',
    sourceUrl: book.sourceUrl || book.source?.landingUrl,
    requiredAttribution: book.rights?.requiredAttribution || book.requiredAttribution,
    license: book.rights?.license || book.license,
    chapterMetadata: (book.chapterMetadata || []).map((chapter) => ({ ...chapter, accessTier: chapter.accessTier || (freeChapterIds.has(chapter.id) ? 'free-demo' : 'premium') })),
  };
}

async function api(path, options) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail?.code || `api_${response.status}`);
  }
  return response.json();
}

export async function loadBookCatalog() {
  const books = await api('/api/books');
  return Array.isArray(books) ? books.map(normalizeApiBook) : [];
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
  const [books, profileId] = await Promise.all([loadBookCatalog(), ensureAnonymousProfile()]);
  const [library, recommendations] = await Promise.all([
    api(`/api/profiles/${profileId}/library`),
    api(`/api/profiles/${profileId}/recommendations`),
  ]);
  return { books, profileId, library: Array.isArray(library) ? library : [], recommendations: Array.isArray(recommendations) ? recommendations : [] };
}

export async function loadChapterReference(profileId, bookId, chapterId) {
  return api(`/api/profiles/${profileId}/books/${bookId}/chapters/${chapterId}`);
}
