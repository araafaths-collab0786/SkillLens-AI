"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { landing } from "@/content/landing";

const DRAWER_LINKS = landing.nav.links;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full bg-white-mist transition-shadow duration-200",
          scrolled && "shadow-md"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="text-lg font-bold text-deep-navy focus-visible:outline-cyan-text"
            aria-label="SkillLens AI — home"
          >
            {landing.nav.logo}
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
            {DRAWER_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-deep-navy hover:text-cyan-text transition-colors duration-200 focus-visible:outline-cyan-text"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-deep-navy transition-all duration-200 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-deep-navy lg:inline-flex items-center"
            >
              {landing.nav.cta}
            </Link>

            {/* Hamburger — visible below lg */}
            <button
              type="button"
              aria-label={drawerOpen ? "Close menu" : "Open menu"}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              onClick={() => setDrawerOpen((o) => !o)}
              className="flex items-center justify-center rounded-lg p-2 text-deep-navy hover:bg-cyan/10 transition-colors duration-200 lg:hidden focus-visible:outline-deep-navy"
            >
              {drawerOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-deep-navy/30 lg:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer panel */}
            <motion.nav
              key="drawer"
              id="mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed right-0 top-0 z-40 flex h-full w-72 max-w-full flex-col bg-white-mist shadow-xl safe-padding-top safe-padding-bottom lg:hidden"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <span className="text-base font-bold text-deep-navy">{landing.nav.logo}</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-lg p-2 text-deep-navy hover:bg-cyan/10 focus-visible:outline-deep-navy"
                >
                  <X size={20} />
                </button>
              </div>
              {/* Drawer links */}
              <ul className="flex flex-col gap-1 px-4 py-4" role="list">
                {DRAWER_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setDrawerOpen(false)}
                      className="block rounded-lg px-4 py-3 text-base font-medium text-deep-navy hover:bg-cyan/10 transition-colors duration-200 focus-visible:outline-deep-navy"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
              {/* Drawer CTA */}
              <div className="mt-auto border-t border-gray-200 px-4 py-6">
                <Link
                  href="/login"
                  onClick={() => setDrawerOpen(false)}
                  className="block w-full rounded-lg bg-cyan px-4 py-3 text-center text-base font-semibold text-deep-navy hover:brightness-95 transition-all duration-200 focus-visible:outline-deep-navy"
                >
                  {landing.nav.cta}
                </Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
