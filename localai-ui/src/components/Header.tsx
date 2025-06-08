import React from 'react';
import { GithubIcon, BookOpenIcon } from 'lucide-react';

export default function Header() {
  return (
    <header className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-indigo-500/20 to-transparent rounded-full blur-3xl"></div>
      </div>

      <div className="relative container mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-6">
            <div className="h-[10rem] flex items-center">
              <img 
                src="/localai-logo-white.png" 
                alt="Local AI Packaged" 
                className="h-full w-auto object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">
                Configurator
              </h1>
              <p className="text-blue-200/80 text-sm mt-1">
                Build your custom configuration with automated dependency management
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a 
              href="https://docs.docker.com/compose/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-all duration-200 border border-white/10 hover:border-white/20"
            >
              <BookOpenIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Documentation</span>
            </a>
            <a
              href="https://github.com/coleam00/local-ai-packaged"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-all duration-200 border border-white/10 hover:border-white/20"
            >
              <GithubIcon className="h-4 w-4" />
              <span className="text-sm font-medium">GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}