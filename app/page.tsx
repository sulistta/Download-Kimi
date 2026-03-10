'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Download, Monitor, Terminal, Smartphone, ChevronDown, ChevronRight,
  Github, ExternalLink, Shield, Zap, Clock, Package,
  CheckCircle2, Plus, Minus, ArrowRight, Sparkles,
  AlertTriangle, RefreshCw, FileDown, Info, Star,
  Layers, Play, Box, Tag, Calendar, HardDrive
} from 'lucide-react';

type OS = 'windows' | 'linux' | 'android' | 'macos' | 'unknown';

type ReleaseAsset = {
  id: number | string;
  name: string;
  size: number;
  browser_download_url: string;
};

type Release = {
  id: number | string;
  tag_name: string;
  published_at: string;
  body: string;
  name?: string;
  assets: ReleaseAsset[];
};

type ReleaseSection = {
  title: string;
  items: string[];
};

type ReleasesApiResponse = {
  releases: Release[];
  fromCache: boolean;
  rateLimited: boolean;
};

// ─── UTILITIES ───────────────────────────────────────────

function detectOS(): OS {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  if (ua.includes('android')) return 'android';
  if (ua.includes('win') || platform.includes('win')) return 'windows';
  if (ua.includes('linux') || platform.includes('linux')) return 'linux';
  if (ua.includes('mac') || platform.includes('mac')) return 'macos';
  return 'unknown';
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatDateShort(dateStr?: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getWindowsAsset(assets?: ReleaseAsset[] | null): ReleaseAsset | null {
  if (!assets) return null;
  return assets.find(a => a.name.endsWith('.exe') && !a.name.endsWith('.exe.sig')) ||
    assets.find(a => a.name.includes('nsis') && !a.name.endsWith('.sig')) ||
    null;
}

function getAndroidAsset(assets?: ReleaseAsset[] | null): ReleaseAsset | null {
  if (!assets) return null;
  return assets.find(a => a.name.endsWith('.apk') && !a.name.endsWith('.sig')) || null;
}

function getLinuxAssets(assets?: ReleaseAsset[] | null) {
  if (!assets) return { appimage: null, deb: null };
  const appimage = assets.find(a => a.name.endsWith('.AppImage') && !a.name.endsWith('.sig')) || null;
  const deb = assets.find(a => a.name.endsWith('.deb') && !a.name.endsWith('.sig')) || null;
  return { appimage, deb };
}

function getPrimaryAsset(assets: ReleaseAsset[] | null | undefined, os: OS) {
  if (os === 'windows') return getWindowsAsset(assets);
  if (os === 'linux') {
    const { appimage, deb } = getLinuxAssets(assets);
    return appimage || deb;
  }
  if (os === 'android') return getAndroidAsset(assets);
  return null;
}

function parseChangelog(body?: string | null): ReleaseSection[] {
  if (!body) return [];
  const sections: ReleaseSection[] = [];
  const lines = body.split('\n');
  let currentSection: ReleaseSection | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^###\s+(.+)/);
    if (sectionMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: sectionMatch[1].trim(), items: [] };
      continue;
    }
    if (line.match(/^##\s/)) continue;
    const itemMatch = line.match(/^\s*-\s+(.+)/);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1].trim());
    } else if (itemMatch && !currentSection) {
      let notesSection = sections.find(section => section.title === 'Notes');
      if (!notesSection) {
        notesSection = { title: 'Notes', items: [] };
      }
      currentSection = notesSection;
      currentSection.items.push(itemMatch[1].trim());
    }
  }
  if (currentSection && currentSection.items.length > 0) sections.push(currentSection);
  
  if (sections.length === 0 && body.trim()) {
    const cleanBody = body.replace(/^##.*$/gm, '').trim();
    if (cleanBody) {
      sections.push({ title: 'Release Notes', items: [cleanBody] });
    }
  }
  return sections;
}

function getSectionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('added') || t.includes('new')) return <Plus className="w-4 h-4" />;
  if (t.includes('changed') || t.includes('updated')) return <RefreshCw className="w-4 h-4" />;
  if (t.includes('fixed') || t.includes('fix')) return <CheckCircle2 className="w-4 h-4" />;
  if (t.includes('removed')) return <Minus className="w-4 h-4" />;
  return <Info className="w-4 h-4" />;
}

function getSectionColor(title: string) {
  const t = title.toLowerCase();
  if (t.includes('added') || t.includes('new')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  if (t.includes('changed') || t.includes('updated')) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  if (t.includes('fixed') || t.includes('fix')) return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
  if (t.includes('removed')) return 'text-red-400 bg-red-400/10 border-red-400/20';
  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
}

function countPlatformAssets(assets?: ReleaseAsset[] | null) {
  let win = 0, linux = 0, android = 0;
  (assets || []).forEach(a => {
    if (a.name.endsWith('.sig') || a.name === 'latest.json') return;
    if (a.name.endsWith('.exe')) win++;
    if (a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) linux++;
    if (a.name.endsWith('.apk')) android++;
  });
  return { win, linux, android };
}

function getAssetBadgeLabel(asset: ReleaseAsset) {
  if (asset.name.endsWith('.exe')) return '.exe';
  if (asset.name.endsWith('.AppImage')) return '.AppImage';
  if (asset.name.endsWith('.deb')) return '.deb';
  if (asset.name.endsWith('.apk')) return '.apk';
  return asset.name.split('.').pop() || asset.name;
}

// ─── ANIMATION VARIANTS ─────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const } }
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } }
};

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } }
};

// ─── COMPONENTS ──────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 animate-spin" />
        </div>
        <div className="text-zinc-400 text-sm font-medium tracking-wide">Loading KimiTV releases...</div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Unable to load releases</h2>
        <p className="text-zinc-400 mb-6 leading-relaxed">
          We couldn't fetch the latest release data from GitHub. This may be due to rate limiting or a temporary network issue.
        </p>
        <button onClick={onRetry} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/25">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <div className="mt-6">
          <a href="https://github.com/sulistta/kimitv-updates/releases" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors inline-flex items-center gap-1">
            Or visit GitHub releases directly <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </motion.div>
    </div>
  );
}

function BetaBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      Beta
    </span>
  );
}

function DownloadButton({
  asset,
  os,
  variant = 'primary',
  label
}: {
  asset: ReleaseAsset | null;
  os: OS;
  variant?: 'primary' | 'secondary';
  label?: string;
}) {
  if (!asset) return null;
  const isPrimary = variant === 'primary';
  const icon = os === 'windows'
    ? <Monitor className={isPrimary ? 'w-5 h-5' : 'w-4 h-4'} />
    : os === 'android'
      ? <Smartphone className={isPrimary ? 'w-5 h-5' : 'w-4 h-4'} />
      : <Terminal className={isPrimary ? 'w-5 h-5' : 'w-4 h-4'} />;
  const defaultLabel = os === 'windows'
    ? 'Download for Windows'
    : os === 'android'
      ? 'Download APK'
      : 'Download for Linux';

  return (
    <motion.a
      href={asset.browser_download_url}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`group inline-flex items-center gap-3 font-semibold rounded-2xl transition-all duration-300 ${
        isPrimary
          ? 'px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black text-lg hover:shadow-2xl hover:shadow-cyan-500/30 glow-accent'
          : 'px-6 py-3 bg-zinc-800/80 text-zinc-200 text-sm border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-700/80'
      }`}
    >
      {icon}
      <span>{label || defaultLabel}</span>
      <Download className={`${isPrimary ? 'w-5 h-5' : 'w-4 h-4'} transition-transform group-hover:translate-y-0.5`} />
    </motion.a>
  );
}

// ─── SECTIONS ────────────────────────────────────────────

function HeroSection({
  release,
  os,
  scrollToChangelog
}: {
  release: Release | null;
  os: OS;
  scrollToChangelog: () => void;
}) {
  if (!release) return null;
  const primaryAsset = getPrimaryAsset(release.assets, os);
  const windowsAsset = getWindowsAsset(release.assets);
  const androidAsset = getAndroidAsset(release.assets);
  const { appimage, deb } = getLinuxAssets(release.assets);
  const linuxPrimaryAsset = appimage || deb;

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#09090b]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyan-500/5 rounded-full blur-[128px]" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-cyan-500/3 rounded-full blur-[100px]" />
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-purple-500/3 rounded-full blur-[80px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-32 text-center">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div variants={fadeUp} className="mb-6">
            <BetaBadge />
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-[0.9]">
            <span className="text-gradient">Kimi</span><span className="text-gradient-accent">TV</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-xl sm:text-2xl lg:text-3xl text-zinc-400 font-light mb-3 tracking-tight">
            Fast. Clean. Built for binge watching.
          </motion.p>

          <motion.p variants={fadeUp} className="text-sm text-zinc-500 mb-10 font-mono">
            {release.tag_name} &middot; Released {formatDate(release.published_at)}
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            {os === 'macos' ? (
              <div className="glass-card rounded-2xl px-8 py-4 text-center">
                <p className="text-zinc-300 font-medium mb-1">macOS is not currently supported</p>
                <p className="text-zinc-500 text-sm">KimiTV Beta is available for Windows, Linux, and Android</p>
              </div>
            ) : os === 'unknown' ? (
              <>
                {windowsAsset && <DownloadButton asset={windowsAsset} os="windows" variant="primary" label="Download for Windows" />}
                {linuxPrimaryAsset && <DownloadButton asset={linuxPrimaryAsset} os="linux" variant={windowsAsset ? 'secondary' : 'primary'} label="Download for Linux" />}
                {androidAsset && <DownloadButton asset={androidAsset} os="android" variant={windowsAsset || linuxPrimaryAsset ? 'secondary' : 'primary'} label="Download APK" />}
              </>
            ) : (
              <>
                <DownloadButton asset={primaryAsset} os={os} variant="primary" />
                {os !== 'windows' && windowsAsset && (
                  <DownloadButton asset={windowsAsset} os="windows" variant="secondary" label="Windows" />
                )}
                {os !== 'linux' && linuxPrimaryAsset && (
                  <DownloadButton asset={linuxPrimaryAsset} os="linux" variant="secondary" label="Linux" />
                )}
                {os !== 'android' && androidAsset && (
                  <DownloadButton asset={androidAsset} os="android" variant="secondary" label="APK" />
                )}
                {os === 'linux' && appimage && deb && (
                  <a href={deb.browser_download_url} className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors underline underline-offset-4">
                    Also available as .deb ({formatBytes(deb.size)})
                  </a>
                )}
              </>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center justify-center gap-6 text-sm text-zinc-500">
            <button onClick={scrollToChangelog} className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer">
              <FileDown className="w-4 h-4" /> View changelog
            </button>
            <a href="https://github.com/sulistta/kimitv-updates" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5">
              <Github className="w-4 h-4" /> GitHub
            </a>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-12 text-xs text-zinc-600 font-mono">
            Powered by GitHub Releases
          </motion.p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="w-5 h-5 text-zinc-600" />
      </motion.div>
    </section>
  );
}

function ReleaseSpotlight({ release, os }: { release: Release | null; os: OS }) {
  if (!release) return null;
  const windowsAsset = getWindowsAsset(release.assets);
  const androidAsset = getAndroidAsset(release.assets);
  const { appimage, deb } = getLinuxAssets(release.assets);
  const linuxPrimaryAsset = appimage || deb;
  const sections = parseChangelog(release.body);
  const highlights = sections.flatMap(s => s.items).slice(0, 3);

  return (
    <section className="relative py-32 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#0a0a0f] to-[#09090b]" />
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
        variants={staggerContainer}
        className="relative z-10 max-w-5xl mx-auto"
      >
        <motion.div variants={fadeUp} className="text-center mb-16">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">Latest Release</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gradient">Release Spotlight</h2>
        </motion.div>

        <motion.div variants={scaleIn} className="glass-card-accent rounded-3xl p-8 sm:p-12 glow-accent">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left column */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Tag className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{release.tag_name}</h3>
                  <p className="text-zinc-500 text-sm">{release.name}</p>
                </div>
                <BetaBadge />
              </div>

              <div className="flex items-center gap-4 text-sm text-zinc-400 mb-6">
                <span className="inline-flex items-center gap-1.5"><Calendar className="w-4 h-4" />{formatDate(release.published_at)}</span>
                <span className="inline-flex items-center gap-1.5"><Package className="w-4 h-4" />{release.assets.filter(a => !a.name.endsWith('.sig') && a.name !== 'latest.json').length} assets</span>
              </div>

              {highlights.length > 0 && (
                <div className="space-y-2 mb-8">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Highlights</p>
                  {highlights.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right column: Download cards */}
            <div className="lg:w-80 space-y-3">
              {windowsAsset && (
                <a href={windowsAsset.browser_download_url} className="group flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/30 transition-all duration-300 hover:bg-zinc-800/60">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Monitor className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Windows</p>
                    <p className="text-xs text-zinc-500 truncate">{windowsAsset.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 font-mono">{formatBytes(windowsAsset.size)}</p>
                    <Download className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors mt-1 ml-auto" />
                  </div>
                </a>
              )}
              {linuxPrimaryAsset && (
                <a href={linuxPrimaryAsset.browser_download_url} className="group flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/30 transition-all duration-300 hover:bg-zinc-800/60">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    linuxPrimaryAsset.name.endsWith('.deb')
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-orange-500/10 border-orange-500/20'
                  }`}>
                    {linuxPrimaryAsset.name.endsWith('.deb')
                      ? <Box className="w-5 h-5 text-green-400" />
                      : <Terminal className="w-5 h-5 text-orange-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{linuxPrimaryAsset.name.endsWith('.deb') ? 'Linux (.deb)' : 'Linux (AppImage)'}</p>
                    <p className="text-xs text-zinc-500 truncate">{linuxPrimaryAsset.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 font-mono">{formatBytes(linuxPrimaryAsset.size)}</p>
                    <Download className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors mt-1 ml-auto" />
                  </div>
                </a>
              )}
              {androidAsset && (
                <a href={androidAsset.browser_download_url} className="group flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/30 transition-all duration-300 hover:bg-zinc-800/60">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Android (.apk)</p>
                    <p className="text-xs text-zinc-500 truncate">{androidAsset.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 font-mono">{formatBytes(androidAsset.size)}</p>
                    <Download className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors mt-1 ml-auto" />
                  </div>
                </a>
              )}
              {appimage && deb && !androidAsset && (
                <a href={deb.browser_download_url} className="group flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/30 transition-all duration-300 hover:bg-zinc-800/60">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                    <Box className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Linux (.deb)</p>
                    <p className="text-xs text-zinc-500 truncate">{deb.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 font-mono">{formatBytes(deb.size)}</p>
                    <Download className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors mt-1 ml-auto" />
                  </div>
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

function ChangelogSection({ release }: { release: Release | null }) {
  if (!release) return null;
  const sections = parseChangelog(release.body);

  return (
    <section id="changelog" className="relative py-32 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#0b0b10] to-[#09090b]" />
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
        variants={staggerContainer}
        className="relative z-10 max-w-4xl mx-auto"
      >
        <motion.div variants={fadeUp} className="text-center mb-16">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">What's New</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gradient">Changelog</h2>
          <p className="text-zinc-500 mt-3 text-lg">{release.tag_name} &middot; {formatDate(release.published_at)}</p>
        </motion.div>

        {sections.length > 0 ? (
          <motion.div variants={staggerContainer} className="space-y-6">
            {sections.map((section, i) => (
              <motion.div key={i} variants={fadeUp} className="glass-card rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${getSectionColor(section.title)}`}>
                    {getSectionIcon(section.title)}
                  </div>
                  <h3 className="text-lg font-bold text-white">{section.title}</h3>
                  <span className="text-xs text-zinc-600 font-mono">{section.items.length} {section.items.length === 1 ? 'item' : 'items'}</span>
                </div>
                <ul className="space-y-3">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-zinc-300 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} className="glass-card rounded-2xl p-8 text-center">
            <p className="text-zinc-400">This release contains routine updates and improvements.</p>
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}

function PreviousReleasesSection({ releases }: { releases: Release[] }) {
  const [expandedId, setExpandedId] = useState<Release['id'] | null>(null);
  const previousReleases = releases.slice(1, 8);

  if (previousReleases.length === 0) return null;

  return (
    <section className="relative py-32 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#0a0a0f] to-[#09090b]" />
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
        variants={staggerContainer}
        className="relative z-10 max-w-4xl mx-auto"
      >
        <motion.div variants={fadeUp} className="text-center mb-16">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">Release History</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gradient">Previous Releases</h2>
        </motion.div>

        <motion.div variants={staggerContainer} className="space-y-3">
          {previousReleases.map((rel) => {
            const isExpanded = expandedId === rel.id;
            const sections = parseChangelog(rel.body);
            const platforms = countPlatformAssets(rel.assets);

            return (
              <motion.div key={rel.id} variants={fadeUp} className="glass-card rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : rel.id)}
                  className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                    <Tag className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">{rel.tag_name}</span>
                      <span className="text-xs text-zinc-600 font-mono hidden sm:inline">{rel.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>{formatDateShort(rel.published_at)}</span>
                      {platforms.win > 0 && <span className="inline-flex items-center gap-1"><Monitor className="w-3 h-3" />Win</span>}
                      {platforms.linux > 0 && <span className="inline-flex items-center gap-1"><Terminal className="w-3 h-3" />Linux</span>}
                      {platforms.android > 0 && <span className="inline-flex items-center gap-1"><Smartphone className="w-3 h-3" />Android</span>}
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-zinc-800/50">
                        {sections.length > 0 ? (
                          <div className="space-y-4 mt-4">
                            {sections.map((s, i) => (
                              <div key={i}>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${getSectionColor(s.title)}`}>
                                    {getSectionIcon(s.title)}{s.title}
                                  </span>
                                </div>
                                <ul className="space-y-1.5 pl-1">
                                  {s.items.map((item, j) => (
                                    <li key={j} className="flex items-start gap-2 text-sm text-zinc-400">
                                      <span className="w-1 h-1 rounded-full bg-zinc-600 mt-2 shrink-0" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-500 mt-4">Routine release with updater artifacts and signatures.</p>
                        )}
                        <div className="flex gap-2 mt-4">
                          {rel.assets.filter(a => !a.name.endsWith('.sig') && a.name !== 'latest.json').map(a => (
                            <a key={a.id} href={a.browser_download_url} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700">
                              <Download className="w-3 h-3" /> {getAssetBadgeLabel(a)}
                              <span className="text-zinc-500">{formatBytes(a.size)}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div variants={fadeUp} className="text-center mt-8">
          <a href="https://github.com/sulistta/kimitv-updates/releases" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-cyan-400 transition-colors">
            View all releases on GitHub <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

function InstallGuideSection() {
  return (
    <section className="relative py-32 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#0b0b10] to-[#09090b]" />
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
        variants={staggerContainer}
        className="relative z-10 max-w-5xl mx-auto"
      >
        <motion.div variants={fadeUp} className="text-center mb-16">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">Quick Start</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gradient">Installation Guide</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Windows */}
          <motion.div variants={fadeUp} className="glass-card rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Monitor className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Windows</h3>
                <p className="text-xs text-zinc-500">Windows 10/11 (x64)</p>
              </div>
            </div>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0 mt-0.5">1</span>
                <div><p className="text-sm text-zinc-300">Download the <span className="text-white font-medium">.exe installer</span> from the latest release</p></div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0 mt-0.5">2</span>
                <div><p className="text-sm text-zinc-300">Run the installer &mdash; Windows may show a SmartScreen warning for unsigned apps, click <span className="text-white font-medium">"More info" → "Run anyway"</span></p></div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-cyan-400 shrink-0 mt-0.5">3</span>
                <div><p className="text-sm text-zinc-300">KimiTV will install and launch automatically. Future updates are delivered in-app.</p></div>
              </li>
            </ol>
          </motion.div>

          {/* Linux */}
          <motion.div variants={fadeUp} className="glass-card rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Linux</h3>
                <p className="text-xs text-zinc-500">Ubuntu 22.04+ / Debian-based (x64)</p>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">AppImage (recommended)</p>
                <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm">
                  <p className="text-zinc-400"><span className="text-cyan-400">chmod</span> +x KimiTV_*.AppImage</p>
                  <p className="text-zinc-400"><span className="text-cyan-400">./</span>KimiTV_*.AppImage</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">.deb package</p>
                <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm">
                  <p className="text-zinc-400"><span className="text-cyan-400">sudo dpkg</span> -i KimiTV_*.deb</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqs = [
    {
      q: 'What is KimiTV Beta?',
      a: 'KimiTV Beta is the pre-release version of the KimiTV desktop media player. It includes the latest features and improvements that are still being tested before a stable release.'
    },
    {
      q: 'How do updates work?',
      a: 'KimiTV includes a built-in auto-updater. New releases are published to the GitHub repository, and the app will notify you when an update is available. You can also always download the latest version from this page.'
    },
    {
      q: 'Is this safe to install?',
      a: 'All releases are published directly from the official GitHub repository with cryptographic signatures. As a beta product, you may encounter occasional bugs, but the application is actively maintained and updated.'
    },
    {
      q: 'Which platforms are supported?',
      a: 'KimiTV Beta currently supports Windows (10/11, x64), Linux (Ubuntu 22.04+, Debian-based, x64), and Android via APK downloads. macOS support is not currently available.'
    },
    {
      q: 'Where can I report issues?',
      a: 'You can report bugs and request features through the GitHub repository. Visit the Issues tab on the project page.'
    },
    {
      q: 'Should I always use the latest release?',
      a: 'Yes. Each new release includes bug fixes, improvements, and security patches. We recommend always updating to the latest available version for the best experience.'
    }
  ];

  return (
    <section className="relative py-32 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-[#09090b] via-[#0a0a0f] to-[#09090b]" />
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }}
        variants={staggerContainer}
        className="relative z-10 max-w-3xl mx-auto"
      >
        <motion.div variants={fadeUp} className="text-center mb-16">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">FAQ</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gradient">Frequently Asked</h2>
        </motion.div>

        <motion.div variants={staggerContainer} className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div key={i} variants={fadeUp} className="glass-card rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <span className="flex-1 text-sm sm:text-base font-medium text-zinc-200">{faq.q}</span>
                <ChevronRight className={`w-5 h-5 text-zinc-500 transition-transform duration-200 shrink-0 ${openIndex === i ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0">
                      <p className="text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-12 text-center">
          <a href="https://github.com/sulistta/kimitv-updates" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-800/80 text-zinc-300 text-sm font-medium border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-700/80 transition-all duration-200">
            <Github className="w-4 h-4" /> Visit GitHub Repository
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

function Footer({ release }: { release: Release | null }) {
  return (
    <footer className="relative border-t border-zinc-800/50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight">
              <span className="text-white">Kimi</span><span className="text-cyan-400">TV</span>
            </span>
            {release && (
              <span className="text-xs font-mono text-zinc-600">{release.tag_name}</span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="https://github.com/sulistta/kimitv-updates" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5">
              <Github className="w-4 h-4" /> GitHub
            </a>
            <a href="https://github.com/sulistta/kimitv-updates/releases" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
              Releases
            </a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} KimiTV. Beta software &mdash; all releases sourced from GitHub.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────

export default function KimiTVPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [os, setOS] = useState<OS>('unknown');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/releases');
      if (!res.ok) throw new Error('Failed to fetch');
      const data: ReleasesApiResponse = await res.json();
      setReleases(data.releases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOS(detectOS());
    fetchData();
  }, [fetchData]);

  const scrollToChangelog = useCallback(() => {
    document.getElementById('changelog')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const latestRelease = releases[0] || null;

  if (loading) return <LoadingSkeleton />;
  if (error || releases.length === 0) return <ErrorState onRetry={fetchData} />;

  return (
    <main className="min-h-screen bg-[#09090b]">
      <HeroSection release={latestRelease} os={os} scrollToChangelog={scrollToChangelog} />
      <ReleaseSpotlight release={latestRelease} os={os} />
      <ChangelogSection release={latestRelease} />
      <PreviousReleasesSection releases={releases} />
      <InstallGuideSection />
      <FAQSection />
      <Footer release={latestRelease} />
    </main>
  );
}
