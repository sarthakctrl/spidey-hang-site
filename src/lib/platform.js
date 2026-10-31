/*
 * Which installer suits this visitor. The app ships three:
 *   win      Windows x64 one-click installer (.exe)
 *   mac-arm  macOS Apple silicon disk image (-arm64.dmg)
 *   mac-x64  macOS Intel disk image (-x64.dmg)
 *   linux    Ubuntu and Debian package (.deb), from the newer app that builds for Linux
 *
 * Safari and Firefox report "Intel" on every Mac, so a Mac is only placed for sure when Chromium's
 * userAgentData gives the architecture. Otherwise the page shows both disk images and how to tell.
 */

/** { os: 'windows' | 'mac' | 'linux' | 'phone' | 'other', pick: 'win' | 'mac-arm' | 'mac-x64' | 'linux' | null } */
export function detectFromStrings({ userAgent = '', platform = '', architecture = '' } = {}) {
  const ua = userAgent.toLowerCase();
  const plat = platform.toLowerCase();
  if (/iphone|ipad|ipod|android/.test(ua) || (plat === 'macintel' && /mobile/.test(ua))) {
    return { os: 'phone', pick: null };
  }
  if (/windows/.test(ua) || plat.startsWith('win')) {
    return { os: 'windows', pick: 'win' };
  }
  if (/mac os x|macintosh/.test(ua) || plat.startsWith('mac')) {
    const arch = architecture.toLowerCase();
    return { os: 'mac', pick: arch === 'arm' ? 'mac-arm' : arch === 'x86' ? 'mac-x64' : null };
  }
  if (/linux/.test(ua) && !/cros/.test(ua)) {
    return { os: 'linux', pick: 'linux' };
  }
  return { os: 'other', pick: null };
}

export async function detectPlatform(nav = globalThis.navigator) {
  if (!nav) {
    return { os: 'other', pick: null };
  }
  let architecture = '';
  try {
    if (nav.userAgentData && nav.userAgentData.getHighEntropyValues) {
      ({ architecture = '' } = await nav.userAgentData.getHighEntropyValues(['architecture']));
    }
  } catch {
    // Not offered: fall back to the user agent alone.
  }
  return detectFromStrings({
    userAgent: nav.userAgent || '',
    platform: nav.userAgentData?.platform || nav.platform || '',
    architecture,
  });
}
