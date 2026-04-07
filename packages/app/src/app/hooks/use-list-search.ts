import { useState, useCallback, useEffect } from "react";

interface UseListSearchOptions<T> {
  items: T[];
  onSelect: (item: T) => void;
  isOpen?: boolean;
}

/**
 * A hook to manage list navigation (arrow keys) and selection (enter key)
 * for search results or any list of items.
 */
export function useListSearch<T>({ 
  items, 
  onSelect, 
  isOpen = true 
}: UseListSearchOptions<T>) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change (e.g. on new search query)
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        e.preventDefault();
        onSelect(selectedItem);
      }
    }
  }, [isOpen, items, selectedIndex, onSelect]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return {
    selectedIndex,
    setSelectedIndex,
  };
}
