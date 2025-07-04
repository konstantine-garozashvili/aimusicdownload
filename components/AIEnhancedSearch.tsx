import React, { useState, useCallback } from 'react';
import { VideoResult } from '../types';
import { searchMusicWithAI } from '../services/geminiService';
import VideoResultCard from './VideoResultCard';
import Loader from './Loader';
import { SearchIcon } from './icons';

const AIEnhancedSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const aiResults = await searchMusicWithAI(query);
      setResults(aiResults);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-2xl font-semibold mb-4 text-center text-gray-200">Find Music with AI</h2>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Type lyrics, mood, or 'upbeat 80s pop'..."
          className="flex-grow bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200"
        />
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader /> : <SearchIcon className="w-5 h-5" />}
          <span>{isLoading ? 'Thinking...' : 'Search'}</span>
        </button>
      </div>

      {error && <p className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p>}
      
      {isLoading && !results.length && (
         <div className="text-center text-gray-400 py-4">AI is searching for the perfect tune...</div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((result, index) => (
            <VideoResultCard key={index} result={result} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AIEnhancedSearch;
