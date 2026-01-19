'use client';

import { useState, useEffect } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
    
    // Load sidebar state from localStorage (desktop only)
    if (!document.documentElement.classList.contains('force-mobile') && window.innerWidth >= 768) {
      const saved = localStorage.getItem('sidebar-open');
      if (saved !== null) {
        setSidebarOpen(saved === 'true');
      }
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      observer.disconnect();
    };
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    
    // Save to localStorage only on desktop
    if (!isMobile) {
      localStorage.setItem('sidebar-open', String(newState));
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Overlay for mobile when sidebar is open */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}
      
      <Sidebar 
        isOpen={sidebarOpen} 
        isMobile={isMobile}
        onClose={closeSidebar}
      />
      
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
