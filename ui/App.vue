<!--
@author Stephan Coertzen (coertzen.jfs@gmail.com)
@license Apache-2.0
antislopscan is open-source software. See LICENSE.TXT for license information.
-->
<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import type { AuditResult } from '../src/domain';
import type { AuditJob } from '../src/history';
import brandMark from '../assets/branding/antislopscan-mark.png';
import inspectionArt from '../assets/branding/intelligence/code-inspection.png';
import { accent, accentNotice, theme, themeNotice, backgroundMotion, motionNotice } from './theme';
import { accentOptions } from './appearance';
import AuditDashboard from './AuditDashboard.vue';
import FindingsExplorer from './FindingsExplorer.vue';
import ArchitecturePanel from './ArchitecturePanel.vue';
import AuditHero from './AuditHero.vue';
import CoveragePanel from './CoveragePanel.vue';
import UiIcon from './UiIcon.vue';
import { auditTimestamp } from './presentation';
import AiSettingsPanel, { type AiPolicy } from './AiSettingsPanel.vue';

const source = ref('.');
const projectName = ref('Repository');
const token = ref('');
const configuration = ref('{}');
const history = ref<AuditJob[]>([]);
const selected = ref<AuditJob & { result?: AuditResult }>();
const error = ref('');
const loading = ref(false);
const submitting = ref(false);
const drill = ref<{ field: string; value: string; serial: number }>();
const offset = ref(0);
const baselineId = ref('');
const aiPolicy = ref<AiPolicy>();
const assessmentOpen = ref(true);
const connectionOpen = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

/** Make a bounded authenticated request; credentials remain only in this page's memory. */
const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
	const headers = new Headers(init.headers);

	if (token.value) headers.set('authorization', `Bearer ${token.value}`);
	const response = await fetch(path, {
		...init,
		headers,
		signal: AbortSignal.timeout(15000),
		redirect: 'error'
	});

	if (!response.ok) {
		const body = await response.json().catch(unreadableError);

		throw new Error(body.error ?? `Request failed with HTTP ${response.status}`);
	}
	return response;
};

/** Supply a safe fallback when an HTTP error response is not JSON. */
const unreadableError = (): { error: string } => ({
	error: 'The appliance returned an unreadable error response'
});

/** Refresh a bounded page of audit summaries. */
const refreshHistory = async (): Promise<void> => {
	const response = await request(`/api/audits?limit=25&offset=${offset.value}`);

	history.value = (await response.json()).audits;
};

/** Load defaults and history, exposing connection failures in the workbench. */
const connect = async (): Promise<void> => {
	error.value = '';
	loading.value = true;
	try {
		const response = await request('/api/config/default');
		const responseData = await response.json();
		const defaults = responseData.config;
		aiPolicy.value = responseData.aiPolicy;

		configuration.value = JSON.stringify(defaults, null, 2);
		await refreshHistory();
		const auditId = new URL(location.href).searchParams.get('audit');

		if (auditId && /^[a-f0-9-]{36}$/i.test(auditId)) await selectAudit(auditId);
		connectionOpen.value = false;
	} catch (failure) {
		error.value = failure instanceof Error ? failure.message : 'Unable to connect';
		connectionOpen.value = true;
	} finally {
		loading.value = false;
	}
};

/** Retrieve one audit and schedule polling only while that selected job remains active. */
const selectAudit = async (id: string): Promise<void> => {
	clearTimeout(timer);
	error.value = '';
	try {
		const response = await request(`/api/audits/${encodeURIComponent(id)}`);

		if (disposed) return;
		selected.value = await response.json();
		assessmentOpen.value = false;
		const url = new URL(location.href);

		url.searchParams.set('audit', id);
		window.history.replaceState(null, '', url);
		if (['queued', 'running'].includes(selected.value!.status)) timer = setTimeout(pollSelected, 1500);
		else await refreshHistory();
	} catch (failure) {
		error.value = failure instanceof Error ? failure.message : 'Unable to load audit';
	}
};

/** Own polling failures through selectAudit's request boundary. */
const pollSelected = (): void => {
	if (selected.value && !disposed) void selectAudit(selected.value.id);
};


/** Open a history selection and move review focus without changing polling or API contracts. */
const openHistoryAudit = async (id: string): Promise<void> => {
	await selectAudit(id);
	if (selected.value?.id !== id) return;
	await nextTick();
	const target = document.getElementById('repository-title') ?? document.getElementById('audit-review');

	target?.focus();
};

/** Validate editor JSON, submit an audit, and open the persisted queued job. */
const submitAudit = async (): Promise<void> => {
	error.value = '';
	submitting.value = true;
	try {
		const config = JSON.parse(configuration.value);

		config.project = { ...config.project, name: projectName.value };
		const response = await request('/api/audits', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				source: source.value,
				config,
				...(baselineId.value ? { baselineId: baselineId.value } : {})
			})
		});
		const accepted = await response.json();

		await refreshHistory();
		await selectAudit(accepted.id);
	} catch (failure) {
		error.value = failure instanceof Error ? failure.message : 'Unable to submit audit';
	} finally {
		submitting.value = false;
	}
};

/** Download one authenticated report through a temporary browser-owned blob URL. */
const download = async (format: string): Promise<void> => {
	if (!selected.value) return;
	error.value = '';
	try {
		const response = await request(`/api/audits/${selected.value.id}/reports/${format}`);
		const url = URL.createObjectURL(await response.blob());
		const anchor = document.createElement('a');

		anchor.href = url;
		anchor.download = `antislopscan.${format === 'sarif' ? 'sarif.json' : format}`;
		anchor.click();
		URL.revokeObjectURL(url);
	} catch (failure) {
		error.value = failure instanceof Error ? failure.message : 'Unable to download report';
	}
};

/** Change the history page and preserve request failures in the visible error state. */
const paginate = async (direction: number): Promise<void> => {
	offset.value = Math.max(0, offset.value + direction * 25);
	try {
		await refreshHistory();
	} catch (failure) {
		error.value = failure instanceof Error ? failure.message : 'Unable to load history';
	}
};

/** Stop polling after this component is removed. */
const cleanup = (): void => {
	disposed = true;
	clearTimeout(timer);
};

/** Focus the evidence explorer after a dashboard or graph drill-down finishes rendering. */
const inspectEvidence = async (field: string, value: string): Promise<void> => {
	drill.value = { field, value, serial: (drill.value?.serial ?? 0) + 1 };
	await nextTick();
	document.getElementById('findings')?.focus();
};

/** Reveal the existing assessment workflow and focus its first field after rendering. */
const startAssessment = async (): Promise<void> => {
	assessmentOpen.value = true;
	await nextTick();
	document.getElementById('project')?.focus();
};

/** Synchronize a native disclosure's open state with application-driven connection errors. */
const syncConnection = (event: Event): void => {
	connectionOpen.value = (event.currentTarget as HTMLDetailsElement).open;
};

/** Close an open header disclosure with Escape and return focus to its summary. */
const closeHeaderDisclosure = (event: KeyboardEvent): void => {
	const disclosure = (event.target as Element).closest('details');

	if (!disclosure) return;
	disclosure.open = false;
	disclosure.querySelector('summary')?.focus();
};

onMounted(connect);
onUnmounted(cleanup);
</script>

<template>
	<a class="skip" href="#workspace">Skip to audit workspace</a>
	<header class="masthead" @keydown.esc="closeHeaderDisclosure">
		<a class="brand" href="#workspace"
			><img :src="brandMark" alt="" width="42" height="42" fetchpriority="high" />
			<div>
				<p class="product">antislopscan</p>
				<span class="brand-description">Software intelligence</span>
			</div></a
		>
		<div class="header-context">
			<span class="context-divider"></span><UiIcon name="layers" /><span>Audit workspace</span>
		</div>
		<div class="header-tools">
			<a class="history-shortcut" href="#history" aria-label="Audit history" title="Audit history"><UiIcon name="clock" /></a>
			<details name="header-tools" class="header-disclosure appearance-settings">
				<summary aria-label="Appearance settings" title="Appearance settings">
					<UiIcon name="settings" /><span>Appearance settings</span><UiIcon name="chevron" />
				</summary>
				<div class="settings-popover">
					<label class="theme-control" for="theme"
						>Appearance<select id="theme" v-model="theme">
							<option value="system">System</option>
							<option value="light">Light</option>
							<option value="dark">Dark</option></select
						><small v-if="themeNotice" role="status">{{ themeNotice }}</small></label
					>
					<label class="theme-control" for="accent-color"
						>Accent color<select id="accent-color" v-model="accent">
							<option v-for="option in accentOptions" :key="option.id" :value="option.id">
								{{ option.label }}
							</option></select
						><small v-if="accentNotice" role="status">{{ accentNotice }}</small></label
					>
					<label class="checkbox-control"
						><input v-model="backgroundMotion" type="checkbox" />Background motion</label
					><small v-if="motionNotice" role="status">{{ motionNotice }}</small>
					<p class="caption">Animation also pauses in hidden tabs and follows reduced-motion preferences.</p>
				</div>
			</details>
			<details name="header-tools" class="header-disclosure" :open="connectionOpen" @toggle="syncConnection">
				<summary aria-label="Connection" title="Connection">
					<UiIcon name="connection" /><span>Connection</span><UiIcon name="chevron" />
				</summary>
				<form class="settings-popover connection" @submit.prevent="connect">
					<label for="token">API bearer token <span class="muted">(if configured)</span></label
					><input id="token" v-model="token" type="password" autocomplete="off" /><button
						class="secondary"
						:disabled="loading"
					>
						{{ loading ? 'Connecting…' : 'Connect' }}
					</button>
					<p class="caption">Credentials stay in this page's memory.</p>
				</form>
			</details>
			<button class="primary new-assessment" @click="startAssessment">
				<UiIcon name="plus" /><span>New assessment</span>
			</button>
		</div>
	</header>
	<main id="workspace" :aria-busy="loading">
		<p v-if="error" role="alert" class="error global-error"><UiIcon name="alert" />{{ error }}</p>
		<p v-if="loading" role="status" class="loading-message">Loading configuration and audit history…</p>
		<div class="workbench">
			<aside class="sidebar" aria-label="Audit configuration and history">
				<div class="sidebar-caption">Workspace</div>
				<nav v-if="selected?.result" class="workspace-nav" aria-label="Application navigation">
					<a href="#dashboard"><UiIcon name="grid" />Overview</a
					><a href="#findings"
						><UiIcon name="scan" />Findings<span>{{
							selected.result.findings.length.toLocaleString()
						}}</span></a
					><a href="#coverage"><UiIcon name="activity" />Coverage</a
					><a href="#architecture"><UiIcon name="network" />Architecture</a>
				</nav>
				<section id="history" class="history" tabindex="-1">
					<div class="history-heading">
						<h2>Audit history</h2>
						<span class="caption">{{
							history.length ? `${offset + 1}–${offset + history.length}` : '0 records'
						}}</span>
					</div>
					<p v-if="!history.length" class="muted">
						No audits recorded. Run an assessment to start a history of structural change.
					</p>
					<ul>
						<li v-for="audit in history" :key="audit.id">
							<button
								:class="{ selected: selected?.id === audit.id }"
								:aria-pressed="selected?.id === audit.id"
								@click="openHistoryAudit(audit.id)"
							>
								<div class="history-project">
									<strong>{{ audit.project }}</strong
									><span class="history-score">{{ audit.score ?? 'N/A' }}</span>
								</div>
								<span class="history-status"
									><UiIcon
										:name="
											audit.status === 'completed'
												? 'circleCheck'
												: audit.status === 'failed'
													? 'circleX'
													: 'clock'
										"
									/>{{ audit.status }}</span
								><small>{{ auditTimestamp(audit.createdAt) }}</small>
							</button>
						</li>
					</ul>
					<div class="history-pagination">
						<button class="secondary" :disabled="offset === 0" @click="paginate(-1)">Previous</button
						><button class="secondary" :disabled="history.length < 25" @click="paginate(1)">Next</button>
					</div>
				</section>
				<div class="sidebar-note">
					<UiIcon name="shield" />
					<p>Local analysis<br /><span>Traceable evidence, explicit limits.</span></p>
				</div>
			</aside>
			<div id="audit-review" class="review" tabindex="-1">
				<section v-if="assessmentOpen" class="setup panel">
					<div class="section-heading">
						<div>
							<p class="folio">New assessment</p>
							<h2>Audit a repository</h2>
						</div>
						<button
							v-if="selected"
							class="icon-button"
							aria-label="Close assessment form"
							@click="assessmentOpen = false"
						>
							<UiIcon name="close" />
						</button>
					</div>
					<p class="section-description">
						Choose a path inside the mounted workspace. Scanners read a private source snapshot.
					</p>
					<form @submit.prevent="submitAudit">
						<div class="assessment-fields">
							<div>
								<label for="project">Project name</label>
								<div class="input-with-icon">
									<UiIcon name="folder" /><input
										id="project"
										v-model="projectName"
										required
										maxlength="200"
									/>
								</div>
							</div>
							<div>
								<label for="source">Workspace-relative source path</label>
								<div class="input-with-icon">
									<UiIcon name="code" /><input
										id="source"
										v-model="source"
										required
										placeholder=". or services/api"
									/>
								</div>
							</div>
							<div>
								<label for="baseline">Baseline audit ID <span class="muted">(optional)</span></label
								><input id="baseline" v-model="baselineId" placeholder="Completed audit UUID" />
							</div>
						</div>
						<AiSettingsPanel v-model:configuration="configuration" :policy="aiPolicy" />
						<details class="disclosure">
							<summary>JSON configuration</summary>
							<div class="disclosure-body">
								<label for="configuration">Appliance configuration</label
								><textarea id="configuration" v-model="configuration" rows="18" spellcheck="false"></textarea>
							</div>
						</details>
						<div class="assessment-submit">
							<button class="primary" :disabled="submitting || loading">
								<UiIcon name="scan" />{{ submitting ? 'Submitting audit…' : 'Run repository audit' }}</button
							><span class="caption">Existing source files remain unchanged.</span>
						</div>
					</form>
				</section>
				<section v-if="!selected" class="empty">
					<div>
						<p class="folio">Code quality meets systems thinking</p>
						<h2>Your next audit starts here.</h2>
						<p>
							Select a repository to inspect findings, scanner coverage, and architectural relationships.
							Compare a later audit against a completed baseline to measure change.
						</p>
						<p class="muted">Unassessable principles and missing scanners stay visible.</p>
					</div>
					<img :src="inspectionArt" alt="" width="300" height="300" class="inspection-art" />
				</section>
				<section v-else-if="!selected.result" class="empty pending-audit">
					<div>
						<p class="folio">Repository assessment</p>
						<h2>{{ selected.project }}</h2>
						<p role="status" class="execution-status">
							<UiIcon :name="selected.status === 'failed' ? 'circleX' : 'clock'" />Audit
							{{ selected.status }}.
						</p>
						<p v-if="selected.error" class="error">{{ selected.error }}</p>
						<p v-else class="muted">
							Scanning source, collecting evidence, and generating reports. You can leave this page and reopen
							the audit from history.
						</p>
						<div
							v-if="selected.status === 'queued' || selected.status === 'running'"
							class="skeleton"
							aria-hidden="true"
						>
							<span></span><span></span><span></span>
						</div>
					</div>
				</section>
				<template v-else>
					<AuditHero :result="selected.result" @download="download" @drill="inspectEvidence" />
					<nav class="section-nav" aria-label="Review sections">
						<a href="#dashboard"><UiIcon name="grid" />Overview</a
						><a href="#findings"><UiIcon name="scan" />Findings</a
						><a href="#coverage"><UiIcon name="activity" />Coverage</a
						><a href="#architecture"><UiIcon name="network" />Architecture</a>
					</nav>
					<AuditDashboard :result="selected.result" @drill="inspectEvidence" />
					<FindingsExplorer :result="selected.result" :drill="drill" />
					<CoveragePanel :result="selected.result" @drill="inspectEvidence" />
					<ArchitecturePanel :result="selected.result" @drill="inspectEvidence" />
					<section class="content-section assessment-limits">
						<h2><UiIcon name="info" />Assessment limits</h2>
						<ul>
							<li v-for="limitation in selected.result.limitations" :key="limitation">{{ limitation }}</li>
						</ul>
					</section>
				</template>
			</div>
		</div>
	</main>
	<footer>
		<span class="footer-brand">antislopscan</span> / Open-source software / Apache-2.0
	</footer>
</template>
