import { useState, useEffect } from 'react';
import useSWR from 'swr';
import type { MatchSearchResult } from '@/types/tennis.types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useMatchSearch(initialQuery: string = '') {
  const [inputValue, setInputValue] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Debounce the input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fetch only when query is >= 3 chars
  const shouldFetch = debouncedQuery.length >= 3;
  
  const { data, error, isLoading } = useSWR<{ matches: MatchSearchResult[], total: number }>(
    shouldFetch ? `/api/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher
  );

  return {
    inputValue,
    setInputValue,
    matches: data?.matches || [],
    isLoading: isLoading && shouldFetch,
    error,
    hasQueried: shouldFetch,
  };
}
