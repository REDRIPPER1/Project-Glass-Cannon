const normalize = (value) => String(value || '').trim().toLowerCase();

export function bookAccessState(book, progress) {
  if (progress.ownedBookIds?.includes(book.id)) return 'owned';
  if (book.accessTier === 'free-demo') return 'free';
  if (book.accessTier === 'purchase-only' || book.purchaseOnly) return 'purchase-only';
  if (progress.subscriptionPlan === 'premium') return 'subscription';
  return 'locked';
}

export function chapterAccessState(book, chapter, progress) {
  if (progress.ownedBookIds?.includes(book.id)) return 'owned';
  if (book.accessTier === 'purchase-only' || book.purchaseOnly) return 'purchase-only';
  if (chapter.accessTier === 'free-demo') return 'free';
  if (progress.subscriptionPlan === 'premium') return 'subscription';
  return 'locked';
}

export function libraryBooks(books, progress) {
  return books.filter((book) => ['owned', 'free', 'subscription'].includes(bookAccessState(book, progress)));
}

export function exactChapterQuest(book, chapter, quests) {
  return quests.find((quest) => (
    normalize(quest.source?.bookTitle) === normalize(book.title)
    && normalize(quest.source?.chapter) === normalize(chapter.title)
  )) || null;
}

export function bookLevelNodes(book, quests, totalLevels = 10) {
  return Array.from({ length: totalLevels }, (_, index) => {
    const chapter = book.chapterMetadata?.[index] || null;
    return {
      id: `${book.id}-level-${index + 1}`,
      level: index + 1,
      chapter,
      quest: chapter ? exactChapterQuest(book, chapter, quests) : null,
    };
  });
}

export function sourceReaderState(book, chapter, access) {
  if (!chapter) return { kind: 'empty', message: 'This level is waiting for a reviewed chapter mapping from the catalog.' };
  if (access === 'locked' || access === 'purchase-only') return { kind: 'locked', message: 'Unlock this chapter to read its provided LitLearn passage.' };
  return { kind: 'ready', message: 'This chapter can be opened in LitLearn only when a reviewed bundled passage is mapped to it.' };
}
