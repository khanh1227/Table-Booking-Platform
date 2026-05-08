import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAutocompleteData } from '../../hooks/useAutocompleteData';
import { FuzzySearch } from '../../lib/fuzzySearch';
import type { AutocompleteItem } from '../../lib/fuzzySearch';

type Props = {
  query: string;
  onSelect: (item: AutocompleteItem) => void;
  onClose: () => void;
  visible: boolean;
};

export default function SearchAutocomplete({ query, onSelect, onClose, visible }: Props) {
  const { data } = useAutocompleteData();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  
  // Memoize fuzzy instance
  const fuzzySearch = useMemo(() => {
    return new FuzzySearch(data);
  }, [data]);

  // Handle results
  const results = useMemo(() => {
    if (!query) return [];
    return fuzzySearch.search(query, 6); // Max 6 items
  }, [query, fuzzySearch]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          e.preventDefault(); // Prevent form submission
          onSelect(results[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, results, selectedIndex, onSelect, onClose]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  if (!visible || !query || results.length === 0) return null;

  return (
    <div 
      ref={wrapperRef}
      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="py-2">
        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Gợi ý kết quả
        </div>
        {results.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={item.id}
              className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-50/80 border-l-4 border-blue-500 pl-3' : 'hover:bg-gray-50 border-l-4 border-transparent'
              }`}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">{item.type === 'restaurant' ? '🏠' : '🍽️'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                    {item.name}
                  </h4>
                  {item.rating && item.type === 'restaurant' && (
                    <span className="flex items-center text-xs font-medium text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                      ⭐ {item.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5 flex flex-wrap gap-1 items-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${item.type === 'restaurant' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                    {item.type === 'restaurant' ? 'Nhà hàng' : 'Món ăn'}
                  </span>
                  {item.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
