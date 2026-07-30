"use client";

import { useTheme } from "@/lib/ThemeProvider";
import styles from "./ThemeMascot.module.css";

function NightBatMascot() {
  return (
    <svg
      className={styles.hero}
      viewBox="0 0 160 160"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* crescent moon */}
      <path
        d="M120,30 a16,16 0 1 0 0,32 a12,12 0 1 1 0,-32"
        fill="var(--accent)"
        opacity="0.9"
      />
      <g className={styles.float}>
        {/* wings */}
        <path d="M40,85 C20,78 8,88 6,102 C18,98 30,98 42,92" fill="#6b6f7a" />
        <path d="M120,85 C140,78 152,88 154,102 C142,98 130,98 118,92" fill="#6b6f7a" />
        {/* body */}
        <ellipse cx="80" cy="95" rx="38" ry="32" fill="#6b6f7a" />
        {/* ears */}
        <path d="M56,68 C54,54 64,50 68,60" fill="#6b6f7a" />
        <path d="M104,68 C106,54 96,50 92,60" fill="#6b6f7a" />
        {/* blush */}
        <circle cx="62" cy="100" r="5" fill="var(--accent)" opacity="0.6" />
        <circle cx="98" cy="100" r="5" fill="var(--accent)" opacity="0.6" />
        {/* sleepy closed eyes */}
        <path d="M64,90 C 66,94 70,94 72,90" stroke="#1c1c1c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M88,90 C 90,94 94,94 96,90" stroke="#1c1c1c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* little feet */}
        <ellipse cx="66" cy="124" rx="8" ry="6" fill="#6b6f7a" />
        <ellipse cx="94" cy="124" rx="8" ry="6" fill="#6b6f7a" />
      </g>
    </svg>
  );
}

function CloudPupMascot() {
  return (
    <svg
      className={styles.pup}
      viewBox="0 0 160 140"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g className={styles.float}>
        {/* fluffy tail */}
        <circle cx="118" cy="90" r="14" fill="#ffffff" stroke="#f0c9dc" strokeWidth="2" />
        {/* body */}
        <ellipse cx="80" cy="85" rx="42" ry="34" fill="#ffffff" stroke="#f0c9dc" strokeWidth="2" />
        {/* ears */}
        <path d="M50,55 C46,38 58,32 64,44" fill="#ffffff" stroke="#f0c9dc" strokeWidth="2" />
        <path d="M96,44 C102,32 114,38 110,55" fill="#ffffff" stroke="#f0c9dc" strokeWidth="2" />
        {/* blush */}
        <circle cx="60" cy="90" r="6" fill="#ffc4dd" opacity="0.8" />
        <circle cx="100" cy="90" r="6" fill="#ffc4dd" opacity="0.8" />
        {/* eyes */}
        <path d="M62,80 C 64,84 68,84 70,80" stroke="#5a4450" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M90,80 C 92,84 96,84 98,80" stroke="#5a4450" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* little paws */}
        <ellipse cx="62" cy="112" rx="10" ry="7" fill="#ffffff" stroke="#f0c9dc" strokeWidth="2" />
        <ellipse cx="98" cy="112" rx="10" ry="7" fill="#ffffff" stroke="#f0c9dc" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function ThemeMascot() {
  const { theme } = useTheme();
  return (
    <div className={styles.container}>
      {theme === "shadow" ? <NightBatMascot /> : <CloudPupMascot />}
    </div>
  );
}
