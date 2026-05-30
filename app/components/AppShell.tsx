"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthInstance } from "../lib/firebase";
import { getUserProfile } from "../lib/records";
import { useAuth } from "./AuthProvider";

const navItems = [
  { href: "/", label: "New Chat" },
  { href: "/history", label: "History" },
  { href: "/gallery/images", label: "Images" },
  { href: "/gallery/videos", label: "Videos" },
];

export function AppShell({
  children,
  pageClassName = "",
}: {
  children: React.ReactNode;
  pageClassName?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setDisplayName("");
      return;
    }

    setDisplayName(user.displayName || "there");

    getUserProfile(user.uid)
      .then((profile) => {
        if (profile?.name) {
          setDisplayName(profile.name);
        }
      })
      .catch(() => {
        setDisplayName(user.displayName || "there");
      });
  }, [user]);

  return (
    <main className={`site-shell${sidebarOpen ? " sidebar-is-open" : ""} ${pageClassName}`}>
      <button
        className="hamburger-button"
        type="button"
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={sidebarOpen}
        aria-controls="main-sidebar"
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <button
        className="sidebar-backdrop"
        type="button"
        aria-label="Close sidebar"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="sidebar" id="main-sidebar" aria-label="Main menu" aria-hidden={!sidebarOpen}>
        <div className="sidebar-brand">
          <span>AERO</span>
          <small>Creative Console</small>
        </div>
        <nav className="sidebar-nav" aria-label="Workspace">
          {navItems.map((item) => (
            <Link
              className={pathname === item.href ? "is-active" : ""}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" onClick={() => signOut(getAuthInstance())}>
            Sign out
          </button>
        </div>
      </aside>

      {displayName ? (
        <div className="dashboard-greeting" aria-label={`Hello, ${displayName}`}>
          <span>Hello,</span>
          <strong>{displayName}</strong>
        </div>
      ) : null}

      {children}
    </main>
  );
}
