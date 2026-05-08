import { useState, useEffect } from 'react';
import type { AutocompleteItem } from '../lib/fuzzySearch';

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// Define a cache to avoid re-fetching on unmount/remount
let globalCache: AutocompleteItem[] | null = null;
let fetchPromise: Promise<AutocompleteItem[]> | null = null;

export function useAutocompleteData() {
  const [data, setData] = useState<AutocompleteItem[]>(globalCache || []);
  const [isLoading, setIsLoading] = useState(!globalCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (globalCache) {
      setData(globalCache);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        if (!fetchPromise) {
          fetchPromise = fetch(`${API_BASE}/api/restaurants/restaurants/autocomplete-data/`).then(res => res.json());
        }
        
        const responseData = await fetchPromise;
        globalCache = responseData;
        setData(responseData);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to fetch autocomplete data", err);
        setError("Failed to load suggestions");
        setIsLoading(false);
        fetchPromise = null; // Reset để cho phép retry ở lần render sau
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
}
