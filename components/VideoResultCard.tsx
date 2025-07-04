import React from 'react';
import { VideoResult } from '../types';
import { PlayIcon } from './icons';

interface VideoResultCardProps {
  result: VideoResult;
}

const VideoResultCard: React.FC<VideoResultCardProps> = ({ result }) => {
  return (
    <a
      href={result.youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-cyan-500/20 transition-all duration-300 border border-gray-700 flex flex-col"
    >
      <div className="relative">
        <img
          src={result.thumbnailUrl}
          alt={`Thumbnail for ${result.title}`}
          className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center">
          <PlayIcon className="w-16 h-16 text-white text-opacity-70 group-hover:text-opacity-100 group-hover:scale-110 transition-all duration-300" />
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-lg text-white truncate" title={result.title}>{result.title}</h3>
          <p className="text-gray-400 text-sm truncate" title={result.artist}>{result.artist}</p>
        </div>
      </div>
    </a>
  );
};

export default VideoResultCard;
