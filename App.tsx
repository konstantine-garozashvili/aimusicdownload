import React from 'react';
import YoutubeDownloader from './components/YoutubeDownloader';
import { MusicIcon } from './components/icons';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-4xl mb-8 text-center">
        <div className="flex items-center justify-center gap-4 mb-2">
          <MusicIcon className="w-10 h-10 text-cyan-400" />
          <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            YouTube Downloader
          </h1>
        </div>
        <p className="text-gray-400 text-lg">
          Téléchargez des vidéos et de la musique depuis YouTube.
        </p>
      </header>

      <main className="w-full max-w-4xl">
        <YoutubeDownloader />
      </main>

      <footer className="mt-16 text-center text-gray-500 text-sm">
        <p>Powered by Gemini & React</p>
        <p>Disclaimer: Downloading copyrighted content may be against YouTube's terms of service.</p>
      </footer>
    </div>
  );
};

export default App;
