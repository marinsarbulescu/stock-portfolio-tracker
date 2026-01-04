"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  userEmail?: string;
  onSignOut: () => void;
  isAdmin?: boolean;
}

export function MobileNav({ userEmail, onSignOut, isAdmin }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative md:hidden" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-muted-foreground hover:text-foreground"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
        data-testid="mobile-menu-toggle"
      >
        {isOpen ? (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
          {userEmail && (
            <div className="px-4 py-2 border-b border-border">
              <p className="text-sm text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>
          )}
          <nav className="py-2 border-b border-border">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              data-testid="mobile-nav-dashboard"
              className={`block px-4 py-2 text-sm ${
                pathname === "/dashboard"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/assets"
              onClick={() => setIsOpen(false)}
              data-testid="mobile-nav-assets"
              className={`block px-4 py-2 text-sm ${
                pathname === "/assets" || pathname?.startsWith("/assets/")
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Assets
            </Link>
            {isAdmin && (
              <Link
                href="/e2e-manager"
                onClick={() => setIsOpen(false)}
                data-testid="mobile-nav-e2e"
                className={`block px-4 py-2 text-sm ${
                  pathname === "/e2e-manager"
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                E2E
              </Link>
            )}
          </nav>
          <button
            onClick={() => {
              setIsOpen(false);
              onSignOut();
            }}
            data-testid="mobile-btn-signout"
            className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
