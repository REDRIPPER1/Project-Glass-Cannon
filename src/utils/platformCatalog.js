import catalog from '../../backend/data/platform-catalogs.json';

export const PLATFORM_CATALOG = catalog;
export const RARITY_COLORS = { Common: '#7c8b83', Rare: '#3d78a8', Epic: '#7a4aa2', Legendary: '#b86b26', Mythical: '#c23f73' };
export const petById = (id) => catalog.pets.find((pet) => pet.id === id);
export const accessoryById = (id) => catalog.accessories.find((item) => item.id === id);
export const rewardById = (id) => catalog.rewards.find((item) => item.id === id);
export const shopItemById = (id) => catalog.shopItems.find((item) => item.id === id);
export const displayCurrency = (currency) => ({
  gold: 'Gold',
  diamonds: 'Diamonds',
  leafTokens: 'Leaf Tokens',
  storyShards: 'Story Shards',
}[currency] || currency);

