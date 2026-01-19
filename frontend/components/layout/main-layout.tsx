'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { useAppStore } from '@/lib/store';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { lang } = useAppStore();

  useEffect(() => {
    // Check if mobile (real device or force-mobile viewport)
    const checkMobile = () => {
      const isRealMobile = window.innerWidth < 768;
      const isForceMobile = document.documentElement.classList.contains('force-mobile');
      const isMobileMode = isRealMobile || isForceMobile;
      
      setIsMobile(isMobileMode);
      
      // Auto-close sidebar in mobile mode
      if (isMobileMode) {
        setSidebarOpen(false);
      } else {
        // On desktop, restore from localStorage
        const saved = localStorage.getItem('sidebar-open');
        if (saved !== null) {
          setSidebarOpen(saved === 'true');
        } else {
          setSidebarOpen(true); // Default open on desktop
        }
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Watch for viewport mode changes
    const observer = new MutationObserver(() => {
      checkMobile();
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      observer.disconnect();
    };
  }, []);

  // Use useCallback to prevent re-creation on every render
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const newState = !prev;
      
      // Save to localStorage only on desktop
      if (!isMobile) {
        localStorage.setItem('sidebar-open', String(newState));
      }
      
      return newState;
    });
  }, [isMobile]);

  // Separate close function with useCallback
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay for mobile when sidebar is open */}
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-overlay fixed inset-0 w-screen h-screen bg-black/60 z-[45] md:hidden backdrop-blur-sm"
          onClick={closeSidebar}
          role="button"
          aria-label="Close sidebar"
        />
      )}
      
      {/* Show sidebar only when open (both mobile and desktop) */}
      {sidebarOpen && (
        <Sidebar 
          isOpen={sidebarOpen} 
          isMobile={isMobile}
          onClose={closeSidebar}
        />
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          onMenuClick={toggleSidebar}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-auto p-3 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
