import { useEffect, useMemo, useRef, useState } from 'react';
import { useAutocompleteData } from '../../hooks/useAutocompleteData';
import type { AutocompleteItem } from '../../lib/fuzzySearch';
import { FuzzySearch } from '../../lib/fuzzySearch';
import { extractRestaurantSegment } from './autocompleteTrigger';

type Props = {
  query: string;
  onSelect: (item: AutocompleteItem) => void;
  onClose: () => void;
  visible: boolean;
};

export default function ChatAutocomplete({ query, onSelect, onClose, visible }: Props) {
  const { data } = useAutocompleteData();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const fuzzySearch = useMemo(() => new FuzzySearch(data), [data]);

  const results = useMemo(() => {
    if (!query) return [];
    const segment = extractRestaurantSegment(query);
    if (segment.length < 2) return [];
    return fuzzySearch.search(segment, 5);
  }, [query, fuzzySearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        onSelect(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, results, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  if (!visible || !query || results.length === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-50"
    >
      <div className="py-1">
        <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Gợi ý tên nhà hàng
        </div>
        {results.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={item.id}
              className={`px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                isSelected ? 'bg-gray-700 border-l-2 border-blue-500 pl-2.5' : 'hover:bg-gray-700/50 border-l-2 border-transparent'
              }`}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="w-8 h-8 rounded shrink-0 overflow-hidden bg-gray-900 flex items-center justify-center">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">🏠</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm truncate ${isSelected ? 'text-blue-400 font-medium' : 'text-gray-200'}`}>
                  {item.name}
                </h4>
                <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
