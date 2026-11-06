/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import type { Category, Severity } from '../domain.js';
import type { IconName } from './icons.js';

export const categoryPresentation: Record<Category, { label: string; icon: IconName; description: string }> =
	{
		slop: {
			label: 'Slop indicators',
			icon: 'scan',
			description: 'Placeholder and generated-code smell indicators'
		},
		codeQuality: {
			label: 'Code quality',
			icon: 'code',
			description: 'Correctness and code-quality evidence'
		},
		architecture: {
			label: 'Architecture',
			icon: 'network',
			description: 'Static structure and architectural boundaries'
		},
		systemsThinking: {
			label: 'Systems thinking',
			icon: 'workflow',
			description: 'Interactions and declared system requirements'
		},
		security: {
			label: 'Security',
			icon: 'shield',
			description: 'Potential unsafe constructs requiring review'
		},
		maintainability: {
			label: 'Maintainability',
			icon: 'wrench',
			description: 'Complexity and duplication indicators'
		},
		technicalDebt: {
			label: 'Technical debt',
			icon: 'branch',
			description: 'Unfinished work and debt indicators'
		}
	};
export const severityIcons: Record<Severity, IconName> = {
	critical: 'circleX',
	major: 'alert',
	minor: 'info',
	info: 'info'
};

/** Format audit metadata in the viewer's locale without changing canonical UTC timestamps. */
export const auditTimestamp = (value: string): string =>
	new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
