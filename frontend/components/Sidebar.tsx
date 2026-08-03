"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { useTheme } from "@/lib/ThemeProvider";
import { supabase } from "@/lib/supabaseClient";
import { BrandName } from "./BrandName";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Chat" },
  { href: "/code", label: "Code" },
  { href: "/docs", label: "Docs Q&A" },
  { href: "/notes", label: "Notes" },
];

const UTILITY_ITEMS = [
  { href: "/memories", label: "Memories" },
  { href: "/roast", label: "Roast Battle" },
  { href: "/about", label: "About" },
];

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [hamburgerHidden, setHamburgerHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      // Hide while scrolling down past the top (where it'd overlap page content on
      // pages that scroll the whole window, e.g. Docs/Notes/Memories/Roast/About -
      // Chat/Code scroll an inner panel instead, so this never triggers there).
      // Scrolling back up even slightly brings it back so it's always reachable.
      setHamburgerHidden(y > lastScrollY.current && y > 60);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initial = session?.user?.email?.[0]?.toUpperCase() ?? "?";

  async function handleLogout() {
    await supabase.auth.signOut();
    const savedTheme = window.localStorage.getItem("kairos-theme");
    window.localStorage.clear();
    if (savedTheme) window.localStorage.setItem("kairos-theme", savedTheme);
    router.push("/login");
  }

  return (
    <>
      <button
        className={`${styles.hamburger} ${hamburgerHidden ? styles.hamburgerHidden : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <MenuIcon />
      </button>

      {open && <div className={styles.overlayOpen} onClick={() => setOpen(false)} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <button className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Close menu">
          ×
        </button>

        <div className={styles.brand}>
          <BrandName />
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ""}`}
              onClick={() => {
                setOpen(false);
                router.push(item.href);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.utilityRow}>
            {UTILITY_ITEMS.map((item) => (
              <button
                key={item.href}
                className={`${styles.utilityItem} ${pathname === item.href ? styles.utilityItemActive : ""}`}
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button className={styles.themeButton} onClick={toggleTheme}>
            {theme === "bubblegum" ? <MoonIcon /> : <SunIcon />}
            {theme === "bubblegum" ? "Shadow mode" : "Bubblegum mode"}
          </button>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{initial}</div>
            <button className={styles.logoutButton} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
