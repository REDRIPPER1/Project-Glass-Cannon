const shelves = {
  Adventure: ['Treasure Island|Robert Louis Stevenson', 'The Call of the Wild|Jack London', 'The Sea-Wolf|Jack London', 'Kidnapped|Robert Louis Stevenson', 'The Lost World|Arthur Conan Doyle', 'The Four Feathers|A. E. W. Mason', 'The Prisoner of Zenda|Anthony Hope', 'The Coral Island|R. M. Ballantyne', 'The Jungle Book|Rudyard Kipling', 'The Man in the Iron Mask|Alexandre Dumas', 'Around the World in Eighty Days|Jules Verne', 'Twenty Thousand Leagues Under the Seas|Jules Verne', 'The Mysterious Island|Jules Verne', 'The Scarlet Pimpernel|Baroness Orczy', 'The Three Musketeers|Alexandre Dumas', 'Robinson Crusoe|Daniel Defoe', 'Gulliver’s Travels|Jonathan Swift'],
  Mystery: ['The Moonstone|Wilkie Collins', 'The Woman in White|Wilkie Collins', 'The Hound of the Baskervilles|Arthur Conan Doyle', 'The Adventures of Sherlock Holmes|Arthur Conan Doyle', 'The Secret Adversary|Agatha Christie', 'The Man Who Was Thursday|G. K. Chesterton', 'The Circular Study|Anna Katharine Green', 'The Leavenworth Case|Anna Katharine Green', 'The Murders in the Rue Morgue|Edgar Allan Poe', 'The Purloined Letter|Edgar Allan Poe', 'The Mystery of Edwin Drood|Charles Dickens', 'The Mystery of a Hansom Cab|Fergus Hume', 'The Red House Mystery|A. A. Milne', 'Trent’s Last Case|E. C. Bentley', 'The Thirty-Nine Steps|John Buchan', 'The Green Rust|Edgar Wallace', 'The Yellow Room|Gaston Leroux'],
  Fantasy: ['Alice’s Adventures in Wonderland|Lewis Carroll', 'Through the Looking-Glass|Lewis Carroll', 'The Wonderful Wizard of Oz|L. Frank Baum', 'The Marvelous Land of Oz|L. Frank Baum', 'Peter Pan|J. M. Barrie', 'The Princess and the Goblin|George MacDonald', 'The Princess and Curdie|George MacDonald', 'At the Back of the North Wind|George MacDonald', 'The King of the Golden River|John Ruskin', 'The Water-Babies|Charles Kingsley', 'The Wind in the Willows|Kenneth Grahame', 'Five Children and It|E. Nesbit', 'The Phoenix and the Carpet|E. Nesbit', 'The Story of the Amulet|E. Nesbit', 'The Lilac Fairy Book|Andrew Lang', 'The Blue Fairy Book|Andrew Lang', 'The Book of Wonder|Lord Dunsany'],
  Nature: ['The Wind in the Willows|Kenneth Grahame', 'Black Beauty|Anna Sewell', 'The Tale of Peter Rabbit|Beatrix Potter', 'The Tale of Squirrel Nutkin|Beatrix Potter', 'The Jungle|Upton Sinclair', 'Walden|Henry David Thoreau', 'A Year in the Fields|John Burroughs', 'Wake-Robin|John Burroughs', 'The Natural History of Selborne|Gilbert White', 'The Story Book of Science|Jean-Henri Fabre', 'The Voyage of the Beagle|Charles Darwin', 'My First Summer in the Sierra|John Muir', 'The Mountains of California|John Muir', 'The Forest|Stewart Edward White', 'Birds and Bees|John Burroughs', 'The Life of the Bee|Maurice Maeterlinck', 'The Secret Garden|Frances Hodgson Burnett'],
  History: ['A Tale of Two Cities|Charles Dickens', 'The Last of the Mohicans|James Fenimore Cooper', 'The Prince and the Pauper|Mark Twain', 'The Courtship of Miles Standish|Henry Wadsworth Longfellow', 'The Story of Joan of Arc|Andrew Lang', 'The Story of King Arthur|James Knowles', 'The Story of the Greeks|H. A. Guerber', 'The Story of the Romans|H. A. Guerber', 'The Story of the Renaissance|William Henry Hudson', 'The Story of Napoleon|L. Du Garde Peach', 'The Story of the World|Elizabeth O’Neill', 'The Boys’ Life of Lincoln|Helen Nicolay', 'The Life of George Washington|Josephine Pollard', 'The Scottish Chiefs|Jane Porter', 'Westward Ho!|Charles Kingsley', 'The White Company|Arthur Conan Doyle', 'The Red Badge of Courage|Stephen Crane'],
  Classics: ['Little Women|Louisa May Alcott', 'Anne of Green Gables|L. M. Montgomery', 'Heidi|Johanna Spyri', 'The Secret Garden|Frances Hodgson Burnett', 'A Little Princess|Frances Hodgson Burnett', 'The Railway Children|E. Nesbit', 'The Swiss Family Robinson|Johann David Wyss', 'The Adventures of Tom Sawyer|Mark Twain', 'The Adventures of Huckleberry Finn|Mark Twain', 'The Little Prince|Antoine de Saint-Exupéry', 'The Velveteen Rabbit|Margery Williams', 'The Happy Prince|Oscar Wilde', 'The Jungle Book|Rudyard Kipling', 'The Merry Adventures of Robin Hood|Howard Pyle', 'The Blue Castle|L. M. Montgomery', 'Pollyanna|Eleanor H. Porter', 'The Time Machine|H. G. Wells'],
};

const entries = Object.entries(shelves).flatMap(([category, books]) => books.map((row) => {
  const [title, author] = row.split('|');
  return { title, author, category };
}));

export const EXPANDED_BOOK_CATALOG = entries.map((book, index) => ({
  ...book,
  id: `web-catalog-${index + 1}`,
  edition: 'Web catalog record — source retrieval pending',
  difficulty: (index % 5) + 1,
  difficultyLabel: ['Starter', 'Explorer', 'Pathfinder', 'Trailblazer', 'Legend'][index % 5],
  accessTier: index % 9 === 0 ? 'free-demo' : index % 4 === 0 ? 'purchase-only' : 'premium',
  chapterMetadata: [],
  webSourceStatus: 'unavailable',
  requiredAttribution: 'Source record will be shown when the reviewed web source is available.',
}));

export function fullBookCatalog(reviewedBooks = []) {
  const normalized = reviewedBooks.map((book, index) => ({
    ...book,
    category: book.category || book.topic || 'Classics',
    difficulty: book.difficulty || (index % 5) + 1,
    difficultyLabel: book.difficultyLabel || ['Starter', 'Explorer', 'Pathfinder', 'Trailblazer', 'Legend'][index % 5],
  }));
  const existingTitles = new Set(normalized.map((book) => book.title));
  return [...normalized, ...EXPANDED_BOOK_CATALOG.filter((book) => !existingTitles.has(book.title))];
}
