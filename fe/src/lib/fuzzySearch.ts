// lib/fuzzySearch.ts
import Fuse from 'fuse.js';

export interface AutocompleteItem {
  id: string; // e.g. "r_1" or "d_1"
  type: 'restaurant' | 'dish';
  name: string;
  restaurant_id: number;
  dish_id?: number;
  subtitle?: string; // address for restaurants, restaurant name for dishes
  rating?: number;
  image_url?: string;
}

export class FuzzySearch {
  private fuse: Fuse<AutocompleteItem>;

  constructor(data: AutocompleteItem[] = []) {
    const options: Fuse.IFuseOptions<AutocompleteItem> = {
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'subtitle', weight: 0.3 }
      ],
      threshold: 0.4, // Lower is more exact, higher is more fuzzy. 0.4 is a good balance.
      includeScore: true,
      shouldSort: true,
      minMatchCharLength: 2,
    };
    
    this.fuse = new Fuse(data, options);
  }

  updateData(data: AutocompleteItem[]) {
    this.fuse.setCollection(data);
  }

  search(query: string, limit: number = 8): AutocompleteItem[] {
    if (!query) return [];
    const results = this.fuse.search(query, { limit });
    return results.map(result => result.item);
  }
}
