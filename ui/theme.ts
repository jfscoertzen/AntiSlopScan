/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { ref, watch } from 'vue';
import { normalizeAccent, type Accent } from './appearance';

export type Theme = 'system' | 'light' | 'dark';

/** Restore a saved appearance; a fresh or storage-restricted page uses the dark-first design. */
const storedTheme = (): Theme => {
	try {
		const value = localStorage.getItem('antislopscan-theme');

		return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
	} catch {
		return 'dark';
	}
};

export const theme = ref<Theme>(storedTheme());
export const themeNotice = ref('');

/** Preserve saved accents; fresh and storage-restricted pages use the intelligence theme's teal accent. */
const storedAccent = (): Accent => {
	try {
		const saved = localStorage.getItem('antislopscan-accent');

		return saved === null ? 'teal' : normalizeAccent(saved);
	} catch {
		return 'teal';
	}
};

export const accent = ref<Accent>(storedAccent());
export const accentNotice = ref('');

/** Apply an explicit palette, or leave CSS to follow OS changes; blocked storage keeps a session preference. */
const applyTheme = (value: Theme): void => {
	if (value === 'system') delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = value;
	try {
		localStorage.setItem('antislopscan-theme', value);
		themeNotice.value = '';
	} catch {
		themeNotice.value = 'Theme applies to this tab; preference could not be saved.';
	}
};

watch(theme, applyTheme, { immediate: true });

/** Apply a named CSS palette and save only its identifier; blocked storage retains this page's selection. */
const applyAccent = (value: Accent): void => {
	const selected = normalizeAccent(value);

	document.documentElement.dataset.accent = selected;
	try {
		localStorage.setItem('antislopscan-accent', selected);
		accentNotice.value = '';
	} catch {
		accentNotice.value = 'Accent applies to this tab; preference could not be saved.';
	}
};

watch(accent, applyAccent, { immediate: true });

/** Read a nonessential motion preference; CSS always honors reduced-motion requirements. */
const storedMotion = (): boolean => {
	try {
		return localStorage.getItem('antislopscan-motion') !== 'off';
	} catch {
		return true;
	}
};

export const backgroundMotion = ref(storedMotion());
export const motionNotice = ref('');

/** Save an optional animation choice without making motion necessary for reading any data. */
const applyMotion = (enabled: boolean): void => {
	try {
		localStorage.setItem('antislopscan-motion', enabled ? 'on' : 'off');
		motionNotice.value = '';
	} catch {
		motionNotice.value = 'Motion applies to this tab; preference could not be saved.';
	}
};

watch(backgroundMotion, applyMotion, { immediate: true });
