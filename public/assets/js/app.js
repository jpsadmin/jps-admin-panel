/**
 * JPS Admin Panel - Frontend JavaScript
 *
 * Handles all AJAX interactions, modals, and UI updates.
 */

(function() {
    'use strict';

    // ============================================
    // Configuration
    // ============================================
    const CONFIG = window.JPS_CONFIG || {
        autoRefresh: 60,
        csrfToken: ''
    };

    let refreshInterval = null;

    // ============================================
    // Utility Functions
    // ============================================

    /**
     * Make an API request
     */
    async function api(action, params = {}) {
        const data = {
            action: action,
            csrf_token: CONFIG.csrfToken,
            ...params
        };

        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': CONFIG.csrfToken
                },
                body: JSON.stringify(data)
            });

            if (response.status === 401) {
                // Redirect to login
                window.location.href = 'login.php';
                return null;
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('API Error:', error);
            showToast('Network error. Please try again.', 'error');
            return null;
        }
    }

    /**
     * Show loading overlay
     */
    function showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
        }
        overlay.classList.remove('hidden');
    }

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Show modal
     */
    function showModal(title, content, footer = '') {
        const container = document.getElementById('modal-container');
        const modalTitle = container.querySelector('.modal-title');
        const modalBody = container.querySelector('.modal-body');
        const modalFooter = container.querySelector('.modal-footer');

        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modalFooter.innerHTML = footer;

        container.classList.remove('hidden');
    }

    /**
     * Hide modal
     */
    function hideModal() {
        document.getElementById('modal-container').classList.add('hidden');
    }

    /**
     * Escape HTML entities
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Strip ANSI codes from text
     */
    function stripAnsi(text) {
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }

    /**
     * Convert ANSI codes to HTML
     */
    function ansiToHtml(text) {
        const colors = {
            '30': '#000000',
            '31': '#ff4444',
            '32': '#00ff88',
            '33': '#ffaa00',
            '34': '#00d4ff',
            '35': '#ff66ff',
            '36': '#00ffff',
            '37': '#ffffff',
            '90': '#888888',
            '91': '#ff6666',
            '92': '#88ff88',
            '93': '#ffff88',
            '94': '#8888ff',
            '95': '#ff88ff',
            '96': '#88ffff',
            '97': '#ffffff'
        };

        // Escape HTML first
        text = escapeHtml(text);

        // Replace ANSI codes
        text = text.replace(/\x1b\[([0-9;]+)m/g, function(match, codes) {
            const codeList = codes.split(';');
            const styles = [];

            for (const code of codeList) {
                if (code === '0') {
                    return '</span>';
                } else if (code === '1') {
                    styles.push('font-weight:bold');
                } else if (colors[code]) {
                    styles.push('color:' + colors[code]);
                }
            }

            if (styles.length === 0) return '';
            return '<span style="' + styles.join(';') + '">';
        });

        return text;
    }

    // ============================================
    // Server Health Functions
    // ============================================

    /**
     * Update health bar
     */
    function updateHealthBar(id, value, status) {
        const bar = document.getElementById(id + '-bar');
        const valueEl = document.getElementById(id + '-value');

        if (bar) {
            bar.style.width = value + '%';
            bar.className = 'health-bar-fill status-' + status;
        }

        if (valueEl) {
            valueEl.textContent = value + '%';
        }
    }

    /**
     * Update service status
     */
    function updateServiceStatus(id, running) {
        const service = document.getElementById('service-' + id);
        if (service) {
            const indicator = service.querySelector('.service-indicator');
            if (indicator) {
                indicator.className = 'service-indicator status-' + (running ? 'ok' : 'critical');
            }
        }
    }

    /**
     * Load server status
     */
    async function loadServerStatus() {
        const result = await api('get_status');

        if (!result || !result.success) {
            showToast('Failed to load server status', 'error');
            return;
        }

        const data = result.data || {};

        // Update CPU
        if (data.cpu) {
            updateHealthBar('cpu', data.cpu.usage, data.cpu.status);
        }

        // Update Memory
        if (data.memory) {
            updateHealthBar('memory', data.memory.usage, data.memory.status);
        }

        // Update Disk
        if (data.disk) {
            updateHealthBar('disk', data.disk.usage, data.disk.status);
        }

        // Update Services
        if (data.services) {
            updateServiceStatus('ols', data.services.ols);
            updateServiceStatus('mariadb', data.services.mariadb);
            updateServiceStatus('fail2ban', data.services.fail2ban);
        }
    }

    /**
     * Show full audit modal
     */
    async function showFullAudit() {
        showLoading('Running full audit...');

        const result = await api('get_full_audit');

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to run audit', 'error');
            return;
        }

        const output = ansiToHtml(result.output || 'No output');
        showModal('Full Server Audit', `<pre>${output}</pre>`);
    }

    // ============================================
    // Sites Functions
    // ============================================

    /**
     * Load sites table
     */
    async function loadSites() {
        const tbody = document.getElementById('sites-tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-row">
                    <div class="inline-spinner"></div>
                    Loading sites...
                </td>
            </tr>
        `;

        const result = await api('get_sites');

        if (!result || !result.success) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="error-row">
                        Error loading sites: ${escapeHtml(result?.error || 'Unknown error')}
                    </td>
                </tr>
            `;
            return;
        }

        const sites = result.sites || [];

        if (sites.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-row">No sites found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sites.map(site => renderSiteRow(site)).join('');

        // Attach event listeners
        attachSiteEventListeners();
    }

    /**
     * Render a site row
     */
    function renderSiteRow(site) {
        const status = (site.status || 'active').toLowerCase();
        const statusClass = status === 'suspended' ? 'status-warning' : 'status-ok';
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);

        const suspendBtn = status === 'suspended'
            ? `<button type="button" class="btn-icon btn-resume" data-domain="${escapeHtml(site.domain)}" title="Resume Site">▶️</button>`
            : `<button type="button" class="btn-icon btn-suspend" data-domain="${escapeHtml(site.domain)}" title="Suspend Site">⏸️</button>`;

        return `
            <tr data-domain="${escapeHtml(site.domain)}">
                <td class="domain-cell">
                    <a href="https://${escapeHtml(site.domain)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site.domain)}</a>
                </td>
                <td>${escapeHtml(site.size)}</td>
                <td>${escapeHtml(site.wp_version)}</td>
                <td>${escapeHtml(site.ssl_expiry)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="actions-cell">
                    <div class="btn-group">
                        <button type="button" class="btn-icon btn-validate" data-domain="${escapeHtml(site.domain)}" title="Validate Site">✓</button>
                        <button type="button" class="btn-icon btn-credentials" data-domain="${escapeHtml(site.domain)}" title="View Credentials">📋</button>
                        <button type="button" class="btn-icon btn-checkpoint" data-domain="${escapeHtml(site.domain)}" title="Create Checkpoint">💾</button>
                        <button type="button" class="btn-icon btn-optimize" data-domain="${escapeHtml(site.domain)}" title="Optimize Site">⚡</button>
                        <button type="button" class="btn-icon btn-perf-audit" data-domain="${escapeHtml(site.domain)}" title="Performance Audit">📊</button>
                        ${suspendBtn}
                        <button type="button" class="btn-icon btn-archive" data-domain="${escapeHtml(site.domain)}" title="Archive Site">📦</button>
                        <button type="button" class="btn-icon btn-logs" data-domain="${escapeHtml(site.domain)}" title="View Logs">📁</button>
                        <a href="https://${escapeHtml(site.domain)}/wp-admin/" target="_blank" rel="noopener noreferrer" class="btn-icon btn-wp-admin" title="WordPress Admin">🔗</a>
                        <button type="button" class="btn-icon btn-reinstall btn-warning" data-domain="${escapeHtml(site.domain)}" title="Reinstall WordPress">🔄</button>
                        <button type="button" class="btn-icon btn-delete btn-danger" data-domain="${escapeHtml(site.domain)}" title="Delete Site">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Attach event listeners to site action buttons
     */
    function attachSiteEventListeners() {
        // Validate
        document.querySelectorAll('.btn-validate').forEach(btn => {
            btn.addEventListener('click', () => validateSite(btn.dataset.domain));
        });

        // Credentials
        document.querySelectorAll('.btn-credentials').forEach(btn => {
            btn.addEventListener('click', () => showCredentials(btn.dataset.domain));
        });

        // Checkpoint
        document.querySelectorAll('.btn-checkpoint').forEach(btn => {
            btn.addEventListener('click', () => createCheckpoint(btn.dataset.domain));
        });

        // Optimize
        document.querySelectorAll('.btn-optimize').forEach(btn => {
            btn.addEventListener('click', () => showOptimizeModal(btn.dataset.domain));
        });

        // Performance Audit
        document.querySelectorAll('.btn-perf-audit').forEach(btn => {
            btn.addEventListener('click', () => showPerfAuditModal(btn.dataset.domain));
        });

        // Suspend
        document.querySelectorAll('.btn-suspend').forEach(btn => {
            btn.addEventListener('click', () => suspendSite(btn.dataset.domain));
        });

        // Resume
        document.querySelectorAll('.btn-resume').forEach(btn => {
            btn.addEventListener('click', () => resumeSite(btn.dataset.domain));
        });

        // Archive
        document.querySelectorAll('.btn-archive').forEach(btn => {
            btn.addEventListener('click', () => archiveSite(btn.dataset.domain));
        });

        // Logs
        document.querySelectorAll('.btn-logs').forEach(btn => {
            btn.addEventListener('click', () => showSiteLogs(btn.dataset.domain));
        });

        // Reinstall WordPress
        document.querySelectorAll('.btn-reinstall').forEach(btn => {
            btn.addEventListener('click', () => showReinstallModal(btn.dataset.domain));
        });

        // Delete
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => showDeleteConfirmation(btn.dataset.domain));
        });
    }

    /**
     * Show site credentials
     */
    async function showCredentials(domain) {
        showLoading('Loading credentials...');

        const result = await api('get_credentials', { domain: domain });

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to load credentials: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        const content = `
            <div class="credentials-display">
                <pre>${escapeHtml(result.output || 'No credentials found')}</pre>
            </div>
        `;

        showModal('Credentials: ' + domain, content);
    }

    /**
     * Create checkpoint
     */
    async function createCheckpoint(domain) {
        showLoading('Creating checkpoint...');

        const result = await api('create_checkpoint', { domain: domain });

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to create checkpoint: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        showToast('Checkpoint created successfully', 'success');
        showModal('Checkpoint Result', `<pre>${ansiToHtml(result.output || 'Checkpoint created')}</pre>`);
    }

    /**
     * Suspend site
     */
    async function suspendSite(domain) {
        if (!confirm('Are you sure you want to suspend ' + domain + '?')) {
            return;
        }

        showLoading('Suspending site...');

        const result = await api('suspend_site', { domain: domain });

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to suspend site: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        showToast('Site suspended successfully', 'success');
        loadSites();
    }

    /**
     * Resume site
     */
    async function resumeSite(domain) {
        showLoading('Resuming site...');

        const result = await api('resume_site', { domain: domain });

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to resume site: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        showToast('Site resumed successfully', 'success');
        loadSites();
    }

    /**
     * Archive site
     */
    async function archiveSite(domain) {
        if (!confirm('Are you sure you want to archive ' + domain + '? This will create a backup archive.')) {
            return;
        }

        showLoading('Creating archive...');

        const result = await api('archive_site', { domain: domain });

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to archive site: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        showToast('Archive created successfully', 'success');
        showModal('Archive Result', `<pre>${ansiToHtml(result.output || 'Archive created')}</pre>`);
    }

    /**
     * Show site logs
     */
    async function showSiteLogs(domain) {
        showLoading('Loading logs...');

        const result = await api('get_site_logs', { domain: domain, lines: 100 });

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to load logs: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        const output = result.output || 'No log entries found';
        const content = `
            <div class="log-viewer">
                <div class="log-content">
                    ${formatLogOutput(output)}
                </div>
            </div>
        `;

        showModal('Error Log: ' + domain, content);
    }

    /**
     * Format log output with highlighting
     */
    function formatLogOutput(output) {
        const lines = output.split('\n');
        return '<div class="log-entries">' + lines.map(line => {
            let formattedLine = escapeHtml(line);

            // Highlight timestamps
            formattedLine = formattedLine.replace(
                /\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[^\]]*)\]/g,
                '<span class="log-timestamp">[$1]</span>'
            );

            // Highlight error levels
            formattedLine = formattedLine.replace(/(ERROR|FATAL|CRITICAL)/gi, '<span class="log-error">$1</span>');
            formattedLine = formattedLine.replace(/(WARN|WARNING)/gi, '<span class="log-warning">$1</span>');
            formattedLine = formattedLine.replace(/(INFO)/gi, '<span class="log-info">$1</span>');

            return '<div class="log-line">' + formattedLine + '</div>';
        }).join('') + '</div>';
    }

    /**
     * Show delete confirmation modal
     */
    function showDeleteConfirmation(domain) {
        const content = `
            <div class="delete-confirmation">
                <div class="warning-banner">
                    <span class="warning-icon">⚠️</span>
                    <strong>Warning: This action cannot be undone!</strong>
                </div>

                <p>You are about to permanently delete the site:</p>
                <p class="domain-display"><strong>${escapeHtml(domain)}</strong></p>

                <p>This will remove:</p>
                <ul>
                    <li>All site files and directories</li>
                    <li>Database and database user</li>
                    <li>Virtual host configuration</li>
                    <li>SSL certificates</li>
                </ul>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="delete-understand-checkbox" required>
                        I understand this action cannot be undone
                    </label>
                </div>

                <div class="form-group">
                    <label for="delete-domain-input">Type the domain name to confirm:</label>
                    <input type="text" id="delete-domain-input" placeholder="${escapeHtml(domain)}" autocomplete="off">
                </div>

                <div class="dialog-actions">
                    <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
                    <button type="button" class="btn btn-danger btn-confirm-delete" disabled data-domain="${escapeHtml(domain)}">
                        Delete Permanently
                    </button>
                </div>
            </div>
        `;

        showModal('Delete Site', content);

        // Attach event listeners
        const checkbox = document.getElementById('delete-understand-checkbox');
        const input = document.getElementById('delete-domain-input');
        const deleteBtn = document.querySelector('.btn-confirm-delete');
        const cancelBtn = document.querySelector('.btn-cancel');

        function updateDeleteButton() {
            const isValid = checkbox.checked && input.value.trim() === domain;
            deleteBtn.disabled = !isValid;
        }

        checkbox.addEventListener('change', updateDeleteButton);
        input.addEventListener('input', updateDeleteButton);

        cancelBtn.addEventListener('click', hideModal);

        deleteBtn.addEventListener('click', async () => {
            if (deleteBtn.disabled) return;

            hideModal();
            showLoading('Deleting site...');

            const result = await api('delete_site', {
                domain: domain,
                confirmation: input.value.trim()
            });

            hideLoading();

            if (!result || !result.success) {
                showToast('Failed to delete site: ' + (result?.error || 'Unknown error'), 'error');
                return;
            }

            showToast('Site deleted successfully', 'success');
            loadSites();
        });
    }

    // ============================================
    // Reinstall WordPress Modal
    // ============================================

    /**
     * Current reinstall state
     */
    let reinstallState = {
        domain: '',
        step: 1,
        preserveUploads: true,
        siteInfo: null
    };

    /**
     * Show reinstall WordPress modal
     */
    async function showReinstallModal(domain) {
        reinstallState = {
            domain: domain,
            step: 1,
            preserveUploads: true,
            siteInfo: null
        };

        // First, get site info
        showLoading('Loading site information...');
        const result = await api('get_site_info', { domain: domain });
        hideLoading();

        if (result && result.success) {
            reinstallState.siteInfo = result.data;
        } else {
            reinstallState.siteInfo = {
                wp_version: 'Unknown',
                site_size: 'Unknown',
                uploads_size: 'Unknown',
                db_size: 'Unknown'
            };
        }

        renderReinstallStep();
    }

    /**
     * Render current reinstall step
     */
    function renderReinstallStep() {
        const domain = reinstallState.domain;
        const info = reinstallState.siteInfo || {};
        let content = '';
        let title = 'Reinstall WordPress';

        switch (reinstallState.step) {
            case 1:
                // Step 1: Warning and options
                title = 'Reinstall WordPress - Step 1 of 3';
                content = `
                    <div class="reinstall-modal">
                        <div class="warning-banner warning-severe">
                            <span class="warning-icon">⚠️</span>
                            <strong>Warning: This will delete all WordPress files!</strong>
                        </div>

                        <p>You are about to reinstall WordPress on:</p>
                        <p class="domain-display"><strong>${escapeHtml(domain)}</strong></p>

                        <div class="site-info-grid">
                            <div class="info-item">
                                <span class="info-label">WordPress Version:</span>
                                <span class="info-value">${escapeHtml(info.wp_version || 'Unknown')}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Site Size:</span>
                                <span class="info-value">${escapeHtml(info.site_size || 'Unknown')}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Uploads Size:</span>
                                <span class="info-value">${escapeHtml(info.uploads_size || 'Unknown')}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Database Size:</span>
                                <span class="info-value">${escapeHtml(info.db_size || 'Unknown')}</span>
                            </div>
                        </div>

                        <div class="reinstall-actions">
                            <h4>This will:</h4>
                            <ul class="action-list">
                                <li class="action-danger">✗ Delete all WordPress core files</li>
                                <li class="action-danger">✗ Delete all themes</li>
                                <li class="action-danger">✗ Delete all plugins</li>
                                <li class="action-success">✓ Create full backup first</li>
                                <li class="action-success">✓ Preserve database (posts, pages, settings)</li>
                                <li class="action-success">✓ Download fresh WordPress</li>
                            </ul>
                        </div>

                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="preserve-uploads-checkbox" checked>
                                <span>Preserve wp-content/uploads (media files)</span>
                            </label>
                        </div>

                        <div class="dialog-actions">
                            <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
                            <button type="button" class="btn btn-warning btn-next-step">
                                Continue →
                            </button>
                        </div>
                    </div>
                `;
                break;

            case 2:
                // Step 2: Type domain to confirm
                title = 'Reinstall WordPress - Step 2 of 3';
                content = `
                    <div class="reinstall-modal">
                        <div class="warning-banner warning-severe">
                            <span class="warning-icon">⚠️</span>
                            <strong>Confirm the domain name</strong>
                        </div>

                        <p>Type the domain name exactly to confirm:</p>
                        <p class="domain-display"><strong>${escapeHtml(domain)}</strong></p>

                        <div class="form-group">
                            <input type="text" id="reinstall-domain-input" placeholder="Type domain here" autocomplete="off">
                        </div>

                        <div class="dialog-actions">
                            <button type="button" class="btn btn-secondary btn-back">← Back</button>
                            <button type="button" class="btn btn-warning btn-next-step" disabled>
                                Continue →
                            </button>
                        </div>
                    </div>
                `;
                break;

            case 3:
                // Step 3: Type REINSTALL to confirm
                title = 'Reinstall WordPress - Step 3 of 3';
                content = `
                    <div class="reinstall-modal">
                        <div class="warning-banner warning-severe">
                            <span class="warning-icon">🔄</span>
                            <strong>Final Confirmation</strong>
                        </div>

                        <p>Type <strong>REINSTALL</strong> in capital letters to proceed:</p>

                        <div class="form-group">
                            <input type="text" id="reinstall-confirm-input" placeholder="Type REINSTALL here" autocomplete="off">
                        </div>

                        <div class="preserve-status">
                            ${reinstallState.preserveUploads
                                ? '<span class="status-ok">✓ Uploads will be preserved</span>'
                                : '<span class="status-warning">✗ Uploads will be deleted</span>'}
                        </div>

                        <div class="dialog-actions">
                            <button type="button" class="btn btn-secondary btn-back">← Back</button>
                            <button type="button" class="btn btn-danger btn-execute-reinstall" disabled>
                                🔄 Reinstall WordPress
                            </button>
                        </div>
                    </div>
                `;
                break;

            case 4:
                // Step 4: Progress
                title = 'Reinstalling WordPress...';
                content = `
                    <div class="reinstall-modal reinstall-progress">
                        <div class="progress-container">
                            <div class="spinner-large"></div>
                            <p id="reinstall-status-text">Creating backup...</p>
                        </div>
                        <p class="progress-note">This may take a few minutes. Please don't close this window.</p>
                    </div>
                `;
                break;

            case 5:
                // Step 5: Result (set by executeReinstall)
                return; // Content is set by executeReinstall
        }

        showModal(title, content);
        attachReinstallListeners();
    }

    /**
     * Attach event listeners for reinstall modal
     */
    function attachReinstallListeners() {
        const step = reinstallState.step;

        // Cancel button
        document.querySelector('.btn-cancel')?.addEventListener('click', hideModal);

        // Back button
        document.querySelector('.btn-back')?.addEventListener('click', () => {
            reinstallState.step--;
            renderReinstallStep();
        });

        if (step === 1) {
            // Preserve uploads checkbox
            const checkbox = document.getElementById('preserve-uploads-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    reinstallState.preserveUploads = checkbox.checked;
                });
            }

            // Next button
            document.querySelector('.btn-next-step')?.addEventListener('click', () => {
                reinstallState.preserveUploads = document.getElementById('preserve-uploads-checkbox')?.checked ?? true;
                reinstallState.step = 2;
                renderReinstallStep();
            });
        }

        if (step === 2) {
            const input = document.getElementById('reinstall-domain-input');
            const nextBtn = document.querySelector('.btn-next-step');

            if (input && nextBtn) {
                input.addEventListener('input', () => {
                    nextBtn.disabled = input.value.trim() !== reinstallState.domain;
                });

                nextBtn.addEventListener('click', () => {
                    if (input.value.trim() === reinstallState.domain) {
                        reinstallState.step = 3;
                        renderReinstallStep();
                    }
                });

                input.focus();
            }
        }

        if (step === 3) {
            const input = document.getElementById('reinstall-confirm-input');
            const executeBtn = document.querySelector('.btn-execute-reinstall');

            if (input && executeBtn) {
                input.addEventListener('input', () => {
                    executeBtn.disabled = input.value !== 'REINSTALL';
                });

                executeBtn.addEventListener('click', () => {
                    if (input.value === 'REINSTALL') {
                        executeReinstall();
                    }
                });

                input.focus();
            }
        }
    }

    /**
     * Execute the reinstall
     */
    async function executeReinstall() {
        reinstallState.step = 4;
        renderReinstallStep();

        const result = await api('reinstall_wordpress', {
            domain: reinstallState.domain,
            preserve_uploads: reinstallState.preserveUploads
        });

        let content;
        let title;

        if (result && result.success) {
            title = 'Reinstall Complete';
            const data = result.data || {};
            content = `
                <div class="reinstall-modal reinstall-success">
                    <div class="success-banner">
                        <span class="success-icon">✓</span>
                        <strong>WordPress reinstalled successfully!</strong>
                    </div>

                    <div class="result-info">
                        <p><strong>Domain:</strong> ${escapeHtml(reinstallState.domain)}</p>
                        <p><strong>Previous Version:</strong> ${escapeHtml(data.old_version || 'Unknown')}</p>
                        <p><strong>New Version:</strong> ${escapeHtml(data.new_version || 'Latest')}</p>
                        <p><strong>Backup Location:</strong> ${escapeHtml(data.backup_path || 'Created')}</p>
                        ${reinstallState.preserveUploads ? '<p><strong>Uploads:</strong> Preserved</p>' : ''}
                    </div>

                    <div class="next-steps">
                        <h4>Next Steps:</h4>
                        <ol>
                            <li>Visit <a href="https://${escapeHtml(reinstallState.domain)}/wp-admin/" target="_blank">WordPress Admin</a></li>
                            <li>Reinstall your theme</li>
                            <li>Reinstall required plugins</li>
                            <li>Verify your content is intact</li>
                        </ol>
                    </div>

                    <div class="dialog-actions">
                        <button type="button" class="btn btn-primary btn-close-modal">Close</button>
                    </div>
                </div>
            `;
        } else {
            title = 'Reinstall Failed';
            content = `
                <div class="reinstall-modal reinstall-error">
                    <div class="error-banner">
                        <span class="error-icon">✗</span>
                        <strong>Reinstall failed</strong>
                    </div>

                    <p class="error-message">${escapeHtml(result?.error || 'An unknown error occurred')}</p>

                    ${result?.output ? `<pre class="error-output">${escapeHtml(result.output)}</pre>` : ''}

                    <p class="recovery-note">
                        If a backup was created, you can restore from it manually.
                    </p>

                    <div class="dialog-actions">
                        <button type="button" class="btn btn-secondary btn-close-modal">Close</button>
                    </div>
                </div>
            `;
        }

        showModal(title, content);

        document.querySelector('.btn-close-modal')?.addEventListener('click', () => {
            hideModal();
            loadSites(); // Refresh sites list
        });
    }

    // ============================================
    // Site Validation Functions
    // ============================================

    /**
     * Validate a single site
     */
    async function validateSite(domain) {
        showLoading('Validating site...');

        const result = await api('validate_site', { domain: domain });

        hideLoading();

        if (!result) {
            showToast('Failed to validate site: Network error', 'error');
            return;
        }

        // Parse and display validation results
        showValidationModal(domain, result);
    }

    /**
     * Validate all sites
     */
    async function validateAllSites() {
        if (!confirm('This will validate all sites. This may take a few minutes. Continue?')) {
            return;
        }

        showLoading('Validating all sites...');

        const result = await api('validate_all_sites');

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to validate sites: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        // Show summary modal
        showValidationSummaryModal(result.results);
    }

    /**
     * Show validation results modal for a single site
     */
    function showValidationModal(domain, result) {
        let content = '';

        if (!result.success && result.error) {
            content = `
                <div class="validation-results validation-error">
                    <div class="validation-header">
                        <span class="validation-status-icon validation-fail">✗</span>
                        <span class="validation-domain">${escapeHtml(domain)}</span>
                    </div>
                    <div class="validation-message error">${escapeHtml(result.error)}</div>
                </div>
            `;
        } else {
            // Try to parse JSON output from jps-validate-site
            let validationData = null;
            if (result.output) {
                try {
                    validationData = JSON.parse(result.output);
                } catch (e) {
                    // If not JSON, just display raw output
                    validationData = null;
                }
            }

            if (validationData) {
                content = renderValidationResults(domain, validationData);
            } else {
                // Fallback: display raw output
                content = `
                    <div class="validation-results">
                        <div class="validation-header">
                            <span class="validation-domain">${escapeHtml(domain)}</span>
                        </div>
                        <pre class="validation-output">${ansiToHtml(result.output || 'No output')}</pre>
                    </div>
                `;
            }
        }

        showModal('Site Validation: ' + domain, content);
    }

    /**
     * Render validation results with color coding
     */
    function renderValidationResults(domain, data) {
        const checks = data.results || [];
        const summary = { passed: data.passed || 0, warnings: data.warnings || 0, failed: data.failed || 0 };

        let checksHtml = '';
        checks.forEach(check => {
            const statusClass = check.status === 'pass' ? 'validation-pass' :
                               check.status === 'warn' ? 'validation-warn' : 'validation-fail';
            const statusIcon = check.status === 'pass' ? '✓' :
                              check.status === 'warn' ? '⚠' : '✗';

            checksHtml += `
                <div class="validation-check ${statusClass}">
                    <span class="check-icon">${statusIcon}</span>
                    <span class="check-name">${escapeHtml(check.name || check.check)}</span>
                    <span class="check-message">${escapeHtml(check.message || '')}</span>
                </div>
            `;
        });

        const overallStatus = summary.failed > 0 ? 'fail' :
                             summary.warnings > 0 ? 'warn' : 'pass';
        const overallIcon = overallStatus === 'pass' ? '✓' :
                           overallStatus === 'warn' ? '⚠' : '✗';
        const overallClass = 'validation-' + overallStatus;

        return `
            <div class="validation-results">
                <div class="validation-header ${overallClass}">
                    <span class="validation-status-icon">${overallIcon}</span>
                    <span class="validation-domain">${escapeHtml(domain)}</span>
                </div>
                <div class="validation-summary">
                    <span class="summary-item summary-pass">✓ ${summary.passed || 0} passed</span>
                    <span class="summary-item summary-warn">⚠ ${summary.warnings || 0} warnings</span>
                    <span class="summary-item summary-fail">✗ ${summary.failed || 0} failed</span>
                </div>
                <div class="validation-checks">
                    ${checksHtml}
                </div>
            </div>
        `;
    }

    /**
     * Show validation summary modal for all sites
     */
    function showValidationSummaryModal(results) {
        let sitesHtml = '';
        let totalPassed = 0;
        let totalWarnings = 0;
        let totalFailed = 0;

        for (const [domain, result] of Object.entries(results)) {
            let siteStatus = 'unknown';
            let siteIcon = '?';
            let siteMessage = '';

            if (!result.success && result.error) {
                siteStatus = 'fail';
                siteIcon = '✗';
                siteMessage = result.error;
                totalFailed++;
            } else if (result.output) {
                try {
                    const data = JSON.parse(result.output);
                    const summary = { passed: data.passed || 0, warnings: data.warnings || 0, failed: data.failed || 0 };

                    if (summary.failed > 0) {
                        siteStatus = 'fail';
                        siteIcon = '✗';
                        totalFailed++;
                    } else if (summary.warnings > 0) {
                        siteStatus = 'warn';
                        siteIcon = '⚠';
                        totalWarnings++;
                    } else {
                        siteStatus = 'pass';
                        siteIcon = '✓';
                        totalPassed++;
                    }

                    siteMessage = `${summary.passed || 0} passed, ${summary.warnings || 0} warnings, ${summary.failed || 0} failed`;
                } catch (e) {
                    siteStatus = result.success ? 'pass' : 'fail';
                    siteIcon = result.success ? '✓' : '✗';
                    if (result.success) totalPassed++;
                    else totalFailed++;
                }
            } else {
                siteStatus = result.success ? 'pass' : 'fail';
                siteIcon = result.success ? '✓' : '✗';
                if (result.success) totalPassed++;
                else totalFailed++;
            }

            sitesHtml += `
                <div class="validation-site-row validation-${siteStatus}">
                    <span class="site-icon">${siteIcon}</span>
                    <span class="site-domain">${escapeHtml(domain)}</span>
                    <span class="site-message">${escapeHtml(siteMessage)}</span>
                    <button type="button" class="btn btn-sm btn-secondary btn-view-details" data-domain="${escapeHtml(domain)}">Details</button>
                </div>
            `;
        }

        const content = `
            <div class="validation-summary-modal">
                <div class="validation-overall-summary">
                    <span class="summary-item summary-pass">✓ ${totalPassed} sites OK</span>
                    <span class="summary-item summary-warn">⚠ ${totalWarnings} warnings</span>
                    <span class="summary-item summary-fail">✗ ${totalFailed} failed</span>
                </div>
                <div class="validation-sites-list">
                    ${sitesHtml}
                </div>
            </div>
        `;

        showModal('Validation Summary - All Sites', content);

        // Attach click handlers for detail buttons
        document.querySelectorAll('.btn-view-details').forEach(btn => {
            btn.addEventListener('click', () => {
                const domain = btn.dataset.domain;
                const siteResult = results[domain];
                showValidationModal(domain, siteResult);
            });
        });
    }

    // ============================================
    // Daily Monitor Functions
    // ============================================

    /**
     * Load daily monitor status
     */
    async function loadMonitorStatus() {
        const container = document.getElementById('monitor-status');
        if (!container) return;

        container.innerHTML = `
            <div class="monitor-loading">
                <div class="inline-spinner"></div>
                Loading monitor status...
            </div>
        `;

        const result = await api('get_monitor_report');

        if (!result || !result.success) {
            container.innerHTML = `
                <div class="monitor-empty">
                    <p>No monitor reports found</p>
                    <p class="text-muted">Run "jps-daily-monitor" to generate a report</p>
                </div>
            `;
            return;
        }

        const report = result.report;
        const summary = report.summary || {};

        // Determine overall status
        let statusClass = 'monitor-healthy';
        let statusIcon = '✅';
        let statusText = 'Healthy';

        if (report.status === 'critical') {
            statusClass = 'monitor-critical';
            statusIcon = '🚨';
            statusText = 'Critical';
        } else if (report.status === 'warning') {
            statusClass = 'monitor-warning';
            statusIcon = '⚠️';
            statusText = 'Warning';
        }

        container.innerHTML = `
            <div class="monitor-overview ${statusClass}">
                <div class="monitor-status-badge">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="status-text">${statusText}</span>
                </div>
                <div class="monitor-meta">
                    <span class="monitor-date">Last check: ${escapeHtml(report.report_date || 'Unknown')}</span>
                </div>
            </div>
            <div class="monitor-details">
                <div class="monitor-stat">
                    <span class="stat-label">Sites</span>
                    <span class="stat-value">
                        <span class="stat-ok">${summary.sites_healthy || 0} OK</span>
                        ${summary.sites_warning > 0 ? `<span class="stat-warn">${summary.sites_warning} warn</span>` : ''}
                        ${summary.sites_critical > 0 ? `<span class="stat-crit">${summary.sites_critical} crit</span>` : ''}
                    </span>
                </div>
                <div class="monitor-stat">
                    <span class="stat-label">SSL</span>
                    <span class="stat-value">
                        <span class="stat-ok">${summary.ssl_ok || 0} OK</span>
                        ${summary.ssl_warning > 0 ? `<span class="stat-warn">${summary.ssl_warning} expiring</span>` : ''}
                    </span>
                </div>
                <div class="monitor-stat">
                    <span class="stat-label">Disk</span>
                    <span class="stat-value ${summary.disk_status === 'warning' ? 'stat-warn' : summary.disk_status === 'critical' ? 'stat-crit' : ''}">${summary.disk_usage_percent || 0}%</span>
                </div>
                <div class="monitor-stat">
                    <span class="stat-label">Memory</span>
                    <span class="stat-value ${summary.memory_status === 'warning' ? 'stat-warn' : ''}">${summary.memory_usage_percent || 0}%</span>
                </div>
                <div class="monitor-stat">
                    <span class="stat-label">Services</span>
                    <span class="stat-value">
                        ${summary.services_down > 0 ? `<span class="stat-crit">${summary.services_down} DOWN</span>` : '<span class="stat-ok">All running</span>'}
                    </span>
                </div>
            </div>
            ${(report.warnings?.length > 0 || report.criticals?.length > 0) ? `
                <div class="monitor-issues">
                    <button type="button" class="btn btn-sm btn-secondary" id="btn-view-monitor-details">View ${(report.warnings?.length || 0) + (report.criticals?.length || 0)} Issues</button>
                </div>
            ` : ''}
        `;

        // Attach handler for view details button
        document.getElementById('btn-view-monitor-details')?.addEventListener('click', () => {
            showMonitorDetails(report);
        });
    }

    /**
     * Show detailed monitor report
     */
    function showMonitorDetails(report) {
        let content = `
            <div class="monitor-report-modal">
                <div class="report-header">
                    <p><strong>Report Date:</strong> ${escapeHtml(report.report_date || 'Unknown')}</p>
                    <p><strong>Server:</strong> ${escapeHtml(report.hostname || 'Unknown')} (${escapeHtml(report.server_ip || '')})</p>
                </div>
        `;

        if (report.criticals && report.criticals.length > 0) {
            content += `
                <div class="report-section report-critical">
                    <h4>Critical Issues (${report.criticals.length})</h4>
                    <ul>
                        ${report.criticals.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (report.warnings && report.warnings.length > 0) {
            content += `
                <div class="report-section report-warnings">
                    <h4>Warnings (${report.warnings.length})</h4>
                    <ul>
                        ${report.warnings.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (report.sites && report.sites.length > 0) {
            content += `
                <div class="report-section">
                    <h4>Site Details</h4>
                    <div class="report-sites">
                        ${report.sites.map(site => {
                            const v = site.validation || {};
                            const statusClass = v.failed > 0 ? 'site-critical' : v.warnings > 0 ? 'site-warning' : 'site-ok';
                            return `
                                <div class="report-site ${statusClass}">
                                    <span class="site-domain">${escapeHtml(site.domain)}</span>
                                    <span class="site-ssl">SSL: ${site.ssl_days_remaining || '?'} days</span>
                                    <span class="site-validation">${v.passed || 0} passed, ${v.warnings || 0} warn, ${v.failed || 0} fail</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        content += '</div>';

        showModal('Daily Monitor Report', content);
    }

    /**
     * Run daily monitor now
     */
    async function runDailyMonitor() {
        if (!confirm('Run a full daily monitor check now? This may take a few minutes.')) {
            return;
        }

        showLoading('Running daily monitor...');

        const result = await api('run_daily_monitor');

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to run daily monitor: ' + (result?.error || 'Unknown error'), 'error');
            // Still try to refresh in case a report was generated despite error
            loadMonitorStatus();
            return;
        }

        showToast('Daily monitor completed', 'success');
        loadMonitorStatus();
    }

    // ============================================
    // Activity Log Functions
    // ============================================

    /**
     * Load activity log
     */
    async function loadActivityLog() {
        const container = document.getElementById('activity-log');
        container.innerHTML = `
            <div class="loading-row">
                <div class="inline-spinner"></div>
                Loading activity log...
            </div>
        `;

        const result = await api('get_lifecycle_log', { lines: 10 });

        if (!result || !result.success) {
            container.innerHTML = '<div class="empty-log">Failed to load activity log</div>';
            return;
        }

        const output = result.output || '';

        if (!output.trim()) {
            container.innerHTML = '<div class="empty-log">No recent activity</div>';
            return;
        }

        container.innerHTML = formatLogOutput(output);
    }

    // ============================================
    // Quick Actions
    // ============================================

    /**
     * Restart OpenLiteSpeed
     */
    async function restartOLS() {
        if (!confirm('Are you sure you want to restart OpenLiteSpeed? This will briefly interrupt all sites.')) {
            return;
        }

        showLoading('Restarting OpenLiteSpeed...');

        const result = await api('restart_ols');

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to restart OpenLiteSpeed: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        showToast('OpenLiteSpeed restarted successfully', 'success');
        showModal('Restart Result', `<pre>${ansiToHtml(result.output || 'OpenLiteSpeed restarted')}</pre>`);

        // Refresh status after a short delay
        setTimeout(loadServerStatus, 2000);
    }

    /**
     * Git pull server tools
     */
    async function switchFMtoAssets() {
        showLoading('Switching File Manager to Assets view...');
        const result = await api('filemanager_assets_view');
        hideLoading();
        if (result && result.success) {
            showToast('File Manager switched to Assets view', 'success');
        } else {
            showToast('Failed to switch view', 'error');
        }
    }

    async function switchFMtoSites() {
        showLoading('Switching File Manager to Sites view...');
        const result = await api('filemanager_sites_view');
        hideLoading();
        if (result && result.success) {
            showToast('File Manager switched to Sites view', 'success');
        } else {
            showToast('Failed to switch view', 'error');
        }
    }

    async function gitPull() {
        showLoading('Pulling updates...');

        const result = await api('git_pull');

        hideLoading();

        if (!result || !result.success) {
            showToast('Failed to pull updates: ' + (result?.error || 'Unknown error'), 'error');
            return;
        }

        showToast('Updates pulled successfully', 'success');
        showModal('Git Pull Result', `<pre>${ansiToHtml(result.output || 'Already up to date')}</pre>`);
    }

    // ============================================
    // Deployment Wizard
    // ============================================

    // Wizard state
    let deployWizard = {
        currentStep: 1,
        domain: '',
        email: 'jayjay@jpshosting.com',
        username: 'jpshost',
        dnsVerified: false,
        jobId: null,
        pollInterval: null,
        credentials: null
    };

    /**
     * Show deploy site wizard
     */
    function showDeploySiteModal() {
        // Reset wizard state
        deployWizard = {
            currentStep: 1,
            domain: '',
            email: 'jayjay@jpshosting.com',
            username: 'jpshost',
            dnsVerified: false,
            jobId: null,
            pollInterval: null,
            credentials: null
        };

        renderDeployWizardStep(1);
    }

    /**
     * Render a specific wizard step
     */
    function renderDeployWizardStep(step) {
        deployWizard.currentStep = step;

        const stepIndicator = `
            <div class="wizard-steps">
                <div class="wizard-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'complete' : ''}">
                    <div class="wizard-step-number">${step > 1 ? '&#x2713;' : '1'}</div>
                    <div class="wizard-step-label">DNS Check</div>
                </div>
                <div class="wizard-step-connector ${step > 1 ? 'active' : ''}"></div>
                <div class="wizard-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'complete' : ''}">
                    <div class="wizard-step-number">${step > 2 ? '&#x2713;' : '2'}</div>
                    <div class="wizard-step-label">Configure</div>
                </div>
                <div class="wizard-step-connector ${step > 2 ? 'active' : ''}"></div>
                <div class="wizard-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'complete' : ''}">
                    <div class="wizard-step-number">${step > 3 ? '&#x2713;' : '3'}</div>
                    <div class="wizard-step-label">Deploy</div>
                </div>
                <div class="wizard-step-connector ${step > 3 ? 'active' : ''}"></div>
                <div class="wizard-step ${step >= 4 ? 'active' : ''}">
                    <div class="wizard-step-number">4</div>
                    <div class="wizard-step-label">Complete</div>
                </div>
            </div>
        `;

        let stepContent = '';
        switch (step) {
            case 1:
                stepContent = renderDnsStep();
                break;
            case 2:
                stepContent = renderConfigStep();
                break;
            case 3:
                stepContent = renderProgressStep();
                break;
            case 4:
                stepContent = renderCompleteStep();
                break;
        }

        const content = `
            <div class="deploy-wizard">
                ${stepIndicator}
                <div class="wizard-content">
                    ${stepContent}
                </div>
            </div>
        `;

        showModal('Deploy New Site', content);
        attachWizardListeners(step);
    }

    /**
     * Step 1: DNS verification
     */
    function renderDnsStep() {
        return `
            <div class="wizard-step-content" id="dns-step">
                <h3>Step 1: Domain & DNS Verification</h3>
                <p class="step-description">Enter the domain name for your new site. We'll verify that DNS is correctly configured before proceeding.</p>

                <div class="form-group">
                    <label for="wizard-domain-input">Domain Name</label>
                    <input type="text" id="wizard-domain-input" class="form-input" placeholder="example.com" value="${escapeHtml(deployWizard.domain)}" autocomplete="off">
                    <small>The full domain name for the new WordPress site</small>
                </div>

                <div id="dns-status" class="dns-status hidden">
                    <div class="dns-checking">
                        <div class="inline-spinner"></div>
                        <span>Checking DNS...</span>
                    </div>
                </div>

                <div id="dns-instructions" class="dns-instructions hidden">
                    <div class="warning-banner">
                        <span class="warning-icon">&#x26A0;&#xFE0F;</span>
                        <div>
                            <strong>DNS Not Configured</strong>
                            <p>Please add the following DNS record before continuing:</p>
                        </div>
                    </div>
                    <div class="dns-record-box">
                        <div class="dns-record-row">
                            <span class="dns-label">Type:</span>
                            <span class="dns-value">A</span>
                        </div>
                        <div class="dns-record-row">
                            <span class="dns-label">Name:</span>
                            <span class="dns-value" id="dns-record-name">@</span>
                        </div>
                        <div class="dns-record-row">
                            <span class="dns-label">Value:</span>
                            <span class="dns-value">69.62.67.12</span>
                        </div>
                    </div>
                    <p class="dns-note">DNS changes can take up to 24 hours to propagate, but usually complete within minutes.</p>
                </div>

                <div id="dns-success" class="dns-success hidden">
                    <div class="success-banner">
                        <span class="success-icon">&#x2705;</span>
                        <div>
                            <strong>DNS Configured Correctly</strong>
                            <p id="dns-success-message">Domain resolves to 69.62.67.12</p>
                        </div>
                    </div>
                </div>

                <div class="wizard-actions">
                    <button type="button" class="btn btn-secondary btn-wizard-cancel">Cancel</button>
                    <button type="button" class="btn btn-primary btn-check-dns" id="btn-check-dns">
                        Check DNS
                    </button>
                    <button type="button" class="btn btn-primary btn-next-step hidden" id="btn-dns-next" disabled>
                        Next: Configure Site
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Step 2: Configuration
     */
    function renderConfigStep() {
        const suggestedUsername = 'jpshost';

        return `
            <div class="wizard-step-content" id="config-step">
                <h3>Step 2: Site Configuration</h3>
                <p class="step-description">Configure the WordPress admin account and site options.</p>

                <div class="config-summary">
                    <div class="config-item">
                        <span class="config-label">Domain:</span>
                        <span class="config-value">${escapeHtml(deployWizard.domain)}</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="wizard-email-input">Admin Email</label>
                    <input type="email" id="wizard-email-input" class="form-input" placeholder="admin@example.com" value="${escapeHtml(deployWizard.email)}">
                    <small>WordPress admin email address for notifications and password reset</small>
                </div>

                <div class="form-group">
                    <label for="wizard-username-input">Admin Username</label>
                    <input type="text" id="wizard-username-input" class="form-input" placeholder="${suggestedUsername}" value="${escapeHtml(deployWizard.username || suggestedUsername)}">
                    <small>WordPress admin username (avoid "admin" for security)</small>
                </div>

                <div class="wizard-actions">
                    <button type="button" class="btn btn-secondary btn-wizard-back">Back</button>
                    <button type="button" class="btn btn-primary btn-start-deploy" id="btn-start-deploy">
                        Start Deployment
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Step 3: Deployment progress
     */
    function renderProgressStep() {
        const steps = [
            { id: 'validate', name: 'Validating prerequisites' },
            { id: 'directories', name: 'Creating directory structure' },
            { id: 'database', name: 'Creating database' },
            { id: 'wordpress', name: 'Installing WordPress' },
            { id: 'vhost', name: 'Configuring virtual host' },
            { id: 'ssl', name: 'Generating SSL certificate' },
            { id: 'permissions', name: 'Setting permissions' },
            { id: 'finalize', name: 'Validating deployment' }
        ];

        const stepItems = steps.map(s => `
            <div class="progress-step pending" id="progress-${s.id}">
                <span class="progress-icon">&#x23F3;</span>
                <span class="progress-name">${s.name}</span>
                <span class="progress-status"></span>
            </div>
        `).join('');

        return `
            <div class="wizard-step-content" id="progress-step">
                <h3>Step 3: Deploying Site</h3>
                <p class="step-description">Please wait while your site is being deployed. This may take a few minutes.</p>

                <div class="deploy-domain-display">
                    <span class="domain-icon">&#x1F310;</span>
                    <span class="domain-name">${escapeHtml(deployWizard.domain)}</span>
                </div>

                <div class="progress-steps" id="deploy-progress-steps">
                    ${stepItems}
                </div>

                <div class="progress-details-toggle">
                    <button type="button" class="btn btn-sm btn-link" id="btn-toggle-details">
                        Show Details
                    </button>
                </div>

                <div class="progress-details hidden" id="deploy-details">
                    <pre id="deploy-log"></pre>
                </div>

                <div class="wizard-actions">
                    <button type="button" class="btn btn-secondary btn-wizard-cancel" disabled id="btn-cancel-deploy">
                        Cancel
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Step 4: Completion
     */
    function renderCompleteStep() {
        const creds = deployWizard.credentials || {};
        const domain = deployWizard.domain;

        return `
            <div class="wizard-step-content" id="complete-step">
                <div class="completion-header">
                    <span class="completion-icon">&#x1F389;</span>
                    <h3>Deployment Complete!</h3>
                    <p>Your WordPress site has been successfully deployed.</p>
                </div>

                <div class="credentials-box">
                    <h4>WordPress Credentials</h4>
                    <div class="credential-row">
                        <span class="credential-label">Site URL:</span>
                        <span class="credential-value">
                            <a href="https://${escapeHtml(domain)}" target="_blank">https://${escapeHtml(domain)}</a>
                        </span>
                    </div>
                    <div class="credential-row">
                        <span class="credential-label">Admin URL:</span>
                        <span class="credential-value">
                            <a href="${escapeHtml(creds.wp_admin_url || 'https://' + domain + '/wp-admin/')}" target="_blank">${escapeHtml(creds.wp_admin_url || 'https://' + domain + '/wp-admin/')}</a>
                        </span>
                    </div>
                    <div class="credential-row">
                        <span class="credential-label">Username:</span>
                        <span class="credential-value">
                            <code>${escapeHtml(creds.wp_username || deployWizard.username)}</code>
                            <button type="button" class="copy-btn" data-copy="${escapeHtml(creds.wp_username || deployWizard.username)}" title="Copy">&#x1F4CB;</button>
                        </span>
                    </div>
                    <div class="credential-row">
                        <span class="credential-label">Password:</span>
                        <span class="credential-value">
                            <code>${escapeHtml(creds.wp_password || '')}</code>
                            <button type="button" class="copy-btn" data-copy="${escapeHtml(creds.wp_password || '')}" title="Copy">&#x1F4CB;</button>
                        </span>
                    </div>
                </div>

                <div class="credentials-box">
                    <h4>Database Credentials</h4>
                    <div class="credential-row">
                        <span class="credential-label">Database:</span>
                        <span class="credential-value">
                            <code>${escapeHtml(creds.db_name || '')}</code>
                        </span>
                    </div>
                    <div class="credential-row">
                        <span class="credential-label">DB User:</span>
                        <span class="credential-value">
                            <code>${escapeHtml(creds.db_user || '')}</code>
                        </span>
                    </div>
                    <div class="credential-row">
                        <span class="credential-label">DB Password:</span>
                        <span class="credential-value">
                            <code>${escapeHtml(creds.db_password || '')}</code>
                            <button type="button" class="copy-btn" data-copy="${escapeHtml(creds.db_password || '')}" title="Copy">&#x1F4CB;</button>
                        </span>
                    </div>
                </div>

                <div class="warning-banner credential-warning">
                    <span class="warning-icon">&#x26A0;&#xFE0F;</span>
                    <span>Save these credentials now! They won't be shown again.</span>
                </div>

                <div class="wizard-actions completion-actions">
                    <button type="button" class="btn btn-secondary" id="btn-visit-site">
                        &#x1F310; Visit Site
                    </button>
                    <button type="button" class="btn btn-secondary" id="btn-wp-admin">
                        &#x1F511; WP Admin
                    </button>
                    <button type="button" class="btn btn-secondary" id="btn-deploy-another">
                        &#x2795; Deploy Another
                    </button>
                    <button type="button" class="btn btn-primary" id="btn-wizard-done">
                        Done
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners for current step
     */
    function attachWizardListeners(step) {
        // Cancel button (always available)
        document.querySelectorAll('.btn-wizard-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                if (deployWizard.pollInterval) {
                    clearInterval(deployWizard.pollInterval);
                }
                hideModal();
            });
        });

        // Back button
        document.querySelectorAll('.btn-wizard-back').forEach(btn => {
            btn.addEventListener('click', () => {
                renderDeployWizardStep(deployWizard.currentStep - 1);
            });
        });

        switch (step) {
            case 1:
                attachDnsStepListeners();
                break;
            case 2:
                attachConfigStepListeners();
                break;
            case 3:
                attachProgressStepListeners();
                break;
            case 4:
                attachCompleteStepListeners();
                break;
        }
    }

    /**
     * DNS step listeners
     */
    function attachDnsStepListeners() {
        const domainInput = document.getElementById('wizard-domain-input');
        const checkBtn = document.getElementById('btn-check-dns');
        const nextBtn = document.getElementById('btn-dns-next');

        if (!domainInput || !checkBtn) return;

        // Focus the input
        domainInput.focus();

        // Check DNS button
        checkBtn.addEventListener('click', async () => {
            const domain = domainInput.value.trim().toLowerCase();
            if (!domain) {
                showToast('Please enter a domain name', 'warning');
                return;
            }

            // Basic validation
            if (!domain.match(/^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}$/)) {
                showToast('Please enter a valid domain name', 'warning');
                return;
            }

            deployWizard.domain = domain;
            await checkDnsStatus();
        });

        // Enter key to check DNS
        domainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                checkBtn.click();
            }
        });

        // Next button
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                renderDeployWizardStep(2);
            });
        }
    }

    /**
     * Check DNS status for domain
     */
    async function checkDnsStatus() {
        const statusEl = document.getElementById('dns-status');
        const instructionsEl = document.getElementById('dns-instructions');
        const successEl = document.getElementById('dns-success');
        const checkBtn = document.getElementById('btn-check-dns');
        const nextBtn = document.getElementById('btn-dns-next');
        const recordNameEl = document.getElementById('dns-record-name');

        // Show checking status
        statusEl.classList.remove('hidden');
        statusEl.querySelector('.dns-checking').style.display = 'flex';
        instructionsEl.classList.add('hidden');
        successEl.classList.add('hidden');
        checkBtn.disabled = true;

        try {
            const result = await api('check_dns', { domain: deployWizard.domain });

            statusEl.querySelector('.dns-checking').style.display = 'none';

            if (result && result.success && result.dns && result.dns.status === 'ok') {
                // DNS is correctly configured
                deployWizard.dnsVerified = true;
                successEl.classList.remove('hidden');
                document.getElementById('dns-success-message').textContent =
                    `${deployWizard.domain} resolves to ${result.dns.resolved_ip}`;

                checkBtn.classList.add('hidden');
                nextBtn.classList.remove('hidden');
                nextBtn.disabled = false;
            } else {
                // DNS not configured or mismatch
                instructionsEl.classList.remove('hidden');
                if (recordNameEl) {
                    // Extract subdomain for DNS record name
                    const parts = deployWizard.domain.split('.');
                    if (parts.length > 2) {
                        recordNameEl.textContent = parts.slice(0, -2).join('.');
                    } else {
                        recordNameEl.textContent = '@';
                    }
                }

                checkBtn.textContent = 'Re-check DNS';
            }
        } catch (err) {
            showToast('Failed to check DNS: ' + err.message, 'error');
        }

        checkBtn.disabled = false;
    }

    /**
     * Config step listeners
     */
    function attachConfigStepListeners() {
        const emailInput = document.getElementById('wizard-email-input');
        const usernameInput = document.getElementById('wizard-username-input');
        const deployBtn = document.getElementById('btn-start-deploy');

        if (!deployBtn) return;

        deployBtn.addEventListener('click', async () => {
            // Validate inputs
            const email = emailInput.value.trim();
            const username = usernameInput.value.trim();

            if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                showToast('Please enter a valid email address', 'warning');
                emailInput.focus();
                return;
            }

            if (!username || username.length < 3) {
                showToast('Please enter a username (at least 3 characters)', 'warning');
                usernameInput.focus();
                return;
            }

            // Store values
            deployWizard.email = email;
            deployWizard.username = username;

            // Start deployment
            await startDeployment();
        });
    }

    /**
     * Start the deployment process (synchronous)
     *
     * Changed from polling to synchronous because background execution
     * doesn't work reliably in PHP web context.
     */
    async function startDeployment() {
        // Move to progress step
        renderDeployWizardStep(3);

        // Disable cancel button during deployment
        const cancelBtn = document.getElementById('btn-cancel-deploy');
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.textContent = 'Deploying...';
        }

        // Show a pulsing indicator on all steps
        const stepIds = ['validate', 'directories', 'database', 'wordpress', 'vhost', 'ssl', 'permissions', 'finalize', 'optimize'];
        stepIds.forEach((id, idx) => {
            const stepEl = document.getElementById(`progress-${id}`);
            if (stepEl) {
                stepEl.className = 'progress-step pending';
            }
        });

        try {
            // Run deployment synchronously - this takes 2-4 minutes
            const result = await api('deploy_site_start', {
                domain: deployWizard.domain,
                email: deployWizard.email,
                username: deployWizard.username
            });

            // Update progress UI with final state
            if (result && result.progress) {
                updateDeploymentProgress(result);
            }

            // Update details log
            const logEl = document.getElementById('deploy-log');
            if (logEl && result?.output) {
                logEl.textContent = result.output;
                logEl.scrollTop = logEl.scrollHeight;
            }

            // Handle result
            if (result && result.complete && result.success) {
                // Mark all steps as complete
                stepIds.forEach(id => {
                    const stepEl = document.getElementById(`progress-${id}`);
                    if (stepEl) {
                        stepEl.className = 'progress-step complete';
                        const icon = stepEl.querySelector('.progress-icon');
                        if (icon) icon.innerHTML = '&#x2714;';
                    }
                });

                deployWizard.credentials = result.credentials;
                showToast('Site deployed successfully!', 'success');
                setTimeout(() => {
                    renderDeployWizardStep(4);
                    loadSites(); // Refresh site list
                }, 1000);
            } else {
                // Deployment failed
                showToast('Deployment failed: ' + (result?.error || 'Check the details for more information'), 'error');

                // Show error state on progress steps
                stepIds.forEach(id => {
                    const stepEl = document.getElementById(`progress-${id}`);
                    if (stepEl && stepEl.classList.contains('pending')) {
                        stepEl.className = 'progress-step';
                    }
                });

                // Re-enable cancel button
                if (cancelBtn) {
                    cancelBtn.disabled = false;
                    cancelBtn.textContent = 'Close';
                }

                // Show details section
                const detailsEl = document.getElementById('deploy-details');
                if (detailsEl) {
                    detailsEl.classList.remove('hidden');
                }
            }
        } catch (err) {
            showToast('Deployment failed: ' + err.message, 'error');
            if (cancelBtn) {
                cancelBtn.disabled = false;
                cancelBtn.textContent = 'Close';
            }
        }
    }

    /**
     * Poll deployment status (kept for backwards compatibility, but no longer used)
     */
    async function pollDeploymentStatus() {
        // This function is no longer used since we switched to synchronous deployment
        // Kept for backwards compatibility in case of rollback
        if (!deployWizard.jobId) return;

        try {
            const result = await api('deploy_site_status', { job_id: deployWizard.jobId });

            if (!result || !result.success) {
                return;
            }

            // Update progress UI
            updateDeploymentProgress(result);

            // Update details log
            const logEl = document.getElementById('deploy-log');
            if (logEl && result.raw) {
                logEl.textContent = result.raw;
                logEl.scrollTop = logEl.scrollHeight;
            }

            // Check if complete or failed
            if (result.complete) {
                clearInterval(deployWizard.pollInterval);
                deployWizard.credentials = result.credentials;
                setTimeout(() => {
                    renderDeployWizardStep(4);
                    loadSites(); // Refresh site list
                }, 1000);
            } else if (result.failed) {
                clearInterval(deployWizard.pollInterval);
                showToast('Deployment failed. Check the details for more information.', 'error');
                const cancelBtn = document.getElementById('btn-cancel-deploy');
                if (cancelBtn) {
                    cancelBtn.disabled = false;
                    cancelBtn.textContent = 'Close';
                }
            }
        } catch (err) {
            console.error('Error polling status:', err);
        }
    }

    /**
     * Update progress step UI based on status
     */
    function updateDeploymentProgress(status) {
        if (!status.progress) return;

        const stepIds = ['validate', 'directories', 'database', 'wordpress', 'vhost', 'ssl', 'permissions', 'finalize'];

        status.progress.forEach(p => {
            const stepEl = document.getElementById(`progress-${p.name}`);
            if (!stepEl) return;

            stepEl.className = 'progress-step';

            if (p.status === 'start') {
                stepEl.classList.add('running');
                stepEl.querySelector('.progress-icon').innerHTML = '&#x1F504;';
            } else if (p.status === 'complete') {
                stepEl.classList.add('complete');
                stepEl.querySelector('.progress-icon').innerHTML = '&#x2705;';
            } else if (p.status === 'error') {
                stepEl.classList.add('failed');
                stepEl.querySelector('.progress-icon').innerHTML = '&#x274C;';
            }

            const statusEl = stepEl.querySelector('.progress-status');
            if (statusEl && p.message) {
                statusEl.textContent = p.status === 'complete' ? '' : p.message;
            }
        });
    }

    /**
     * Progress step listeners
     */
    function attachProgressStepListeners() {
        const toggleBtn = document.getElementById('btn-toggle-details');
        const detailsEl = document.getElementById('deploy-details');

        if (toggleBtn && detailsEl) {
            toggleBtn.addEventListener('click', () => {
                detailsEl.classList.toggle('hidden');
                toggleBtn.textContent = detailsEl.classList.contains('hidden') ? 'Show Details' : 'Hide Details';
            });
        }
    }

    /**
     * Complete step listeners
     */
    function attachCompleteStepListeners() {
        // Copy buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-copy');
                if (text) {
                    navigator.clipboard.writeText(text).then(() => {
                        showToast('Copied to clipboard', 'success');
                    });
                }
            });
        });

        // Visit site
        const visitBtn = document.getElementById('btn-visit-site');
        if (visitBtn) {
            visitBtn.addEventListener('click', () => {
                window.open('https://' + deployWizard.domain, '_blank');
            });
        }

        // WP Admin
        const adminBtn = document.getElementById('btn-wp-admin');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                window.open('https://' + deployWizard.domain + '/wp-admin/', '_blank');
            });
        }

        // Deploy another
        const anotherBtn = document.getElementById('btn-deploy-another');
        if (anotherBtn) {
            anotherBtn.addEventListener('click', () => {
                showDeploySiteModal();
            });
        }

        // Done
        const doneBtn = document.getElementById('btn-wizard-done');
        if (doneBtn) {
            doneBtn.addEventListener('click', () => {
                hideModal();
            });
        }
    }

    /**
     * Save audit snapshot
     */
    async function saveAuditSnapshot() {
        showLoading('Saving audit snapshot...');

        const result = await api('save_audit_snapshot');

        hideLoading();

        if (!result) {
            showToast('Failed to save snapshot: Network error', 'error');
            return;
        }

        // Show modal if we have output, even if command returned non-zero exit code
        // (jps-audit --save may return exit code 5 due to jq parse errors but still work)
        if (result.output) {
            if (result.success) {
                showToast('Audit snapshot saved successfully', 'success');
            }
            showModal('Snapshot Result', `<pre>${ansiToHtml(result.output)}</pre>`);
        } else if (!result.success) {
            showToast('Failed to save snapshot: ' + (result.error || 'Unknown error'), 'error');
        } else {
            showToast('Audit snapshot saved successfully', 'success');
            showModal('Snapshot Result', `<pre>Snapshot saved successfully</pre>`);
        }
    }

    /**
     * Compare drift
     */
    async function compareDrift() {
        showLoading('Comparing configuration drift...');

        const result = await api('compare_drift');

        hideLoading();

        if (!result) {
            showToast('Failed to compare drift: Network error', 'error');
            return;
        }

        // Show modal if we have output, even if command returned non-zero exit code
        if (result.output) {
            showModal('Configuration Drift', `<pre>${ansiToHtml(result.output)}</pre>`);
        } else if (!result.success) {
            showToast('Failed to compare drift: ' + (result.error || 'Unknown error'), 'error');
        } else {
            showModal('Configuration Drift', `<pre>No drift detected</pre>`);
        }
    }

    // ============================================
    // Site Optimization
    // ============================================

    /**
     * Optimization modal state
     */
    let optimizeState = {
        domain: '',
        preset: '',
        currentSettings: null
    };

    /**
     * Show optimization modal for a site
     */
    async function showOptimizeModal(domain) {
        optimizeState = {
            domain: domain,
            preset: '',
            currentSettings: null
        };

        // Load current optimization status
        showLoading('Loading optimization status...');
        const statusResult = await api('get_optimization_status', { domain: domain });
        hideLoading();

        if (statusResult && statusResult.success) {
            optimizeState.currentSettings = statusResult;
        }

        renderOptimizeModal();
    }

    /**
     * Render the optimization modal
     */
    function renderOptimizeModal() {
        const domain = optimizeState.domain;
        const current = optimizeState.currentSettings || {};
        const phpSettings = current.php_settings || {};
        const lscacheStatus = current.lscache_status || 'unknown';

        // Build current settings display
        let currentSettingsHtml = '';
        if (Object.keys(phpSettings).length > 0) {
            currentSettingsHtml = `
                <div class="current-settings">
                    <h4>Current PHP Settings</h4>
                    <div class="settings-grid">
                        ${Object.entries(phpSettings).map(([key, value]) => `
                            <div class="setting-item">
                                <span class="setting-key">${escapeHtml(key)}</span>
                                <span class="setting-value">${escapeHtml(value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            currentSettingsHtml = `
                <div class="current-settings">
                    <p class="text-muted">No custom PHP settings configured.</p>
                </div>
            `;
        }

        const lscacheStatusClass = lscacheStatus === 'active' ? 'status-ok' :
                                   lscacheStatus === 'inactive' ? 'status-warning' : 'status-unknown';
        const lscacheStatusText = lscacheStatus === 'active' ? 'Active' :
                                  lscacheStatus === 'inactive' ? 'Inactive' : 'Unknown';

        const content = `
            <div class="optimize-modal">
                <div class="optimize-header">
                    <span class="optimize-icon">⚡</span>
                    <div class="optimize-info">
                        <h3>Optimize Site</h3>
                        <p class="domain-display">${escapeHtml(domain)}</p>
                    </div>
                </div>

                <div class="optimize-status">
                    <div class="status-item">
                        <span class="status-label">LiteSpeed Cache:</span>
                        <span class="status-badge ${lscacheStatusClass}">${lscacheStatusText}</span>
                    </div>
                </div>

                ${currentSettingsHtml}

                <div class="preset-selector">
                    <h4>Select Optimization Preset</h4>
                    <p class="preset-description">Choose a preset that matches your site type:</p>

                    <div class="preset-options">
                        <label class="preset-option">
                            <input type="radio" name="preset" value="woo">
                            <div class="preset-card">
                                <div class="preset-icon">🛒</div>
                                <div class="preset-details">
                                    <strong>WooCommerce</strong>
                                    <span>E-commerce sites (512MB RAM, 300s timeout)</span>
                                </div>
                            </div>
                        </label>

                        <label class="preset-option">
                            <input type="radio" name="preset" value="blog">
                            <div class="preset-card">
                                <div class="preset-icon">📝</div>
                                <div class="preset-details">
                                    <strong>Blog</strong>
                                    <span>Content-focused blogs (256MB RAM, 120s timeout)</span>
                                </div>
                            </div>
                        </label>

                        <label class="preset-option">
                            <input type="radio" name="preset" value="docs">
                            <div class="preset-card">
                                <div class="preset-icon">📚</div>
                                <div class="preset-details">
                                    <strong>Documentation</strong>
                                    <span>Wiki/docs sites (128MB RAM, 60s timeout)</span>
                                </div>
                            </div>
                        </label>

                        <label class="preset-option">
                            <input type="radio" name="preset" value="brochure">
                            <div class="preset-card">
                                <div class="preset-icon">🏢</div>
                                <div class="preset-details">
                                    <strong>Brochure</strong>
                                    <span>Simple portfolio sites (128MB RAM, 30s timeout)</span>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="optimize-actions">
                    <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
                    <button type="button" class="btn btn-primary btn-apply-optimization" disabled>
                        ⚡ Apply Optimization
                    </button>
                </div>
            </div>
        `;

        showModal('Site Optimization', content);
        attachOptimizeListeners();
    }

    /**
     * Attach listeners for optimize modal
     */
    function attachOptimizeListeners() {
        // Cancel button
        document.querySelector('.btn-cancel')?.addEventListener('click', hideModal);

        // Preset selection
        document.querySelectorAll('input[name="preset"]').forEach(radio => {
            radio.addEventListener('change', () => {
                optimizeState.preset = radio.value;
                const applyBtn = document.querySelector('.btn-apply-optimization');
                if (applyBtn) {
                    applyBtn.disabled = false;
                }
            });
        });

        // Apply optimization button
        document.querySelector('.btn-apply-optimization')?.addEventListener('click', async () => {
            if (!optimizeState.preset) {
                showToast('Please select a preset', 'warning');
                return;
            }

            await applyOptimization();
        });
    }

    /**
     * Apply optimization to site
     */
    async function applyOptimization() {
        const domain = optimizeState.domain;
        const preset = optimizeState.preset;

        hideModal();
        showLoading(`Applying ${preset} optimization to ${domain}...`);

        const result = await api('optimize_site', {
            domain: domain,
            preset: preset,
            audit: true
        });

        hideLoading();

        if (!result) {
            showToast('Failed to apply optimization: Network error', 'error');
            return;
        }

        if (result.success) {
            showToast(`Optimization applied successfully to ${domain}`, 'success');

            // Show result modal
            let resultContent = `
                <div class="optimization-result">
                    <div class="success-banner">
                        <span class="success-icon">✓</span>
                        <strong>Optimization Applied Successfully</strong>
                    </div>

                    <div class="result-info">
                        <p><strong>Domain:</strong> ${escapeHtml(domain)}</p>
                        <p><strong>Preset:</strong> ${escapeHtml(preset)}</p>
                    </div>
            `;

            if (result.optimization) {
                const opt = result.optimization;
                if (opt.php) {
                    resultContent += `
                        <div class="result-section">
                            <h4>PHP Settings Applied</h4>
                            <div class="settings-grid">
                                ${Object.entries(opt.php).map(([key, value]) => `
                                    <div class="setting-item">
                                        <span class="setting-key">${escapeHtml(key)}</span>
                                        <span class="setting-value">${escapeHtml(value)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                if (opt.lscache) {
                    resultContent += `
                        <div class="result-section">
                            <h4>LiteSpeed Cache Status</h4>
                            <p>${escapeHtml(opt.lscache.status || 'configured')}</p>
                        </div>
                    `;
                }
            }

            resultContent += `
                    <div class="result-note">
                        <p>OpenLiteSpeed has been reloaded. Changes are now active.</p>
                    </div>
                </div>
            `;

            showModal('Optimization Result', resultContent);
        } else {
            showToast('Failed to apply optimization: ' + (result.error || 'Unknown error'), 'error');

            if (result.output) {
                showModal('Optimization Error', `<pre>${ansiToHtml(result.output)}</pre>`);
            }
        }
    }

    // ============================================
    // Performance Audit (PageSpeed Insights)
    // ============================================

    /**
     * Performance audit modal state
     */
    let perfAuditState = {
        domain: '',
        strategy: 'mobile',
        result: null
    };

    /**
     * Show performance audit modal for a site
     */
    function showPerfAuditModal(domain) {
        perfAuditState = {
            domain: domain,
            strategy: 'mobile',
            result: null
        };

        renderPerfAuditModal();
    }

    /**
     * Render the performance audit modal
     */
    function renderPerfAuditModal() {
        const domain = perfAuditState.domain;
        const strategy = perfAuditState.strategy;
        const result = perfAuditState.result;

        let resultHtml = '';
        if (result) {
            resultHtml = renderPerfAuditResults(result);
        } else {
            resultHtml = `
                <div class="perf-audit-placeholder">
                    <p>Click "Run Audit" to analyze performance using Google PageSpeed Insights.</p>
                    <p class="text-muted">This may take up to 60 seconds.</p>
                </div>
            `;
        }

        const content = `
            <div class="perf-audit-modal">
                <div class="perf-audit-header">
                    <span class="perf-audit-icon">📊</span>
                    <div class="perf-audit-info">
                        <h3>Performance Audit</h3>
                        <p class="domain-display">${escapeHtml(domain)}</p>
                    </div>
                </div>

                <div class="strategy-selector">
                    <label class="strategy-option ${strategy === 'mobile' ? 'active' : ''}">
                        <input type="radio" name="strategy" value="mobile" ${strategy === 'mobile' ? 'checked' : ''}>
                        <span class="strategy-icon">📱</span>
                        <span>Mobile</span>
                    </label>
                    <label class="strategy-option ${strategy === 'desktop' ? 'active' : ''}">
                        <input type="radio" name="strategy" value="desktop" ${strategy === 'desktop' ? 'checked' : ''}>
                        <span class="strategy-icon">💻</span>
                        <span>Desktop</span>
                    </label>
                </div>

                <div class="perf-audit-results">
                    ${resultHtml}
                </div>

                <div class="perf-audit-actions">
                    <button type="button" class="btn btn-secondary btn-cancel">Close</button>
                    <button type="button" class="btn btn-primary btn-run-audit">
                        🚀 Run Audit
                    </button>
                </div>
            </div>
        `;

        showModal('Performance Audit', content);
        attachPerfAuditListeners();
    }

    /**
     * Render performance audit results
     */
    function renderPerfAuditResults(audit) {
        const scores = audit.scores || {};
        const metrics = audit.metrics || {};
        const timestamp = audit.timestamp || '';

        // Helper to get score class
        const getScoreClass = (score) => {
            if (score >= 90) return 'score-good';
            if (score >= 50) return 'score-moderate';
            return 'score-poor';
        };

        // Helper to format time
        const formatTime = (ms) => {
            if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
            return Math.round(ms) + 'ms';
        };

        // Helper to get metric status
        const getMetricStatus = (name, value) => {
            const thresholds = {
                fcp: { good: 1800, poor: 3000 },
                lcp: { good: 2500, poor: 4000 },
                tbt: { good: 200, poor: 600 },
                cls: { good: 0.1, poor: 0.25 },
                speed_index: { good: 3400, poor: 5800 }
            };
            const t = thresholds[name];
            if (!t) return 'unknown';
            if (value <= t.good) return 'good';
            if (value <= t.poor) return 'moderate';
            return 'poor';
        };

        return `
            <div class="perf-audit-timestamp">
                Audited: ${timestamp ? new Date(timestamp).toLocaleString() : 'Just now'}
            </div>

            <div class="score-cards">
                <div class="score-card ${getScoreClass(scores.performance || 0)}">
                    <div class="score-value">${scores.performance || 0}</div>
                    <div class="score-label">Performance</div>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${scores.performance || 0}%"></div>
                    </div>
                </div>
                <div class="score-card ${getScoreClass(scores.accessibility || 0)}">
                    <div class="score-value">${scores.accessibility || 0}</div>
                    <div class="score-label">Accessibility</div>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${scores.accessibility || 0}%"></div>
                    </div>
                </div>
                <div class="score-card ${getScoreClass(scores.best_practices || 0)}">
                    <div class="score-value">${scores.best_practices || 0}</div>
                    <div class="score-label">Best Practices</div>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${scores.best_practices || 0}%"></div>
                    </div>
                </div>
                <div class="score-card ${getScoreClass(scores.seo || 0)}">
                    <div class="score-value">${scores.seo || 0}</div>
                    <div class="score-label">SEO</div>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${scores.seo || 0}%"></div>
                    </div>
                </div>
            </div>

            <div class="core-web-vitals">
                <h4>Core Web Vitals</h4>
                <table class="vitals-table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Value</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="vital-${getMetricStatus('fcp', metrics.fcp || 0)}">
                            <td><strong>FCP</strong> First Contentful Paint</td>
                            <td>${formatTime(metrics.fcp || 0)}</td>
                            <td><span class="vital-status">${getMetricStatus('fcp', metrics.fcp || 0) === 'good' ? '✓ Good' : getMetricStatus('fcp', metrics.fcp || 0) === 'moderate' ? '○ Needs Work' : '✗ Poor'}</span></td>
                        </tr>
                        <tr class="vital-${getMetricStatus('lcp', metrics.lcp || 0)}">
                            <td><strong>LCP</strong> Largest Contentful Paint</td>
                            <td>${formatTime(metrics.lcp || 0)}</td>
                            <td><span class="vital-status">${getMetricStatus('lcp', metrics.lcp || 0) === 'good' ? '✓ Good' : getMetricStatus('lcp', metrics.lcp || 0) === 'moderate' ? '○ Needs Work' : '✗ Poor'}</span></td>
                        </tr>
                        <tr class="vital-${getMetricStatus('tbt', metrics.tbt || 0)}">
                            <td><strong>TBT</strong> Total Blocking Time</td>
                            <td>${formatTime(metrics.tbt || 0)}</td>
                            <td><span class="vital-status">${getMetricStatus('tbt', metrics.tbt || 0) === 'good' ? '✓ Good' : getMetricStatus('tbt', metrics.tbt || 0) === 'moderate' ? '○ Needs Work' : '✗ Poor'}</span></td>
                        </tr>
                        <tr class="vital-${getMetricStatus('cls', metrics.cls || 0)}">
                            <td><strong>CLS</strong> Cumulative Layout Shift</td>
                            <td>${(metrics.cls || 0).toFixed(3)}</td>
                            <td><span class="vital-status">${getMetricStatus('cls', metrics.cls || 0) === 'good' ? '✓ Good' : getMetricStatus('cls', metrics.cls || 0) === 'moderate' ? '○ Needs Work' : '✗ Poor'}</span></td>
                        </tr>
                        <tr class="vital-${getMetricStatus('speed_index', metrics.speed_index || 0)}">
                            <td><strong>SI</strong> Speed Index</td>
                            <td>${formatTime(metrics.speed_index || 0)}</td>
                            <td><span class="vital-status">${getMetricStatus('speed_index', metrics.speed_index || 0) === 'good' ? '✓ Good' : getMetricStatus('speed_index', metrics.speed_index || 0) === 'moderate' ? '○ Needs Work' : '✗ Poor'}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            ${audit.recommendations && audit.recommendations.length > 0 ? `
                <div class="perf-recommendations">
                    <h4>Top Recommendations</h4>
                    <ul>
                        ${audit.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    }

    /**
     * Attach listeners for performance audit modal
     */
    function attachPerfAuditListeners() {
        // Cancel button
        document.querySelector('.btn-cancel')?.addEventListener('click', hideModal);

        // Strategy selection
        document.querySelectorAll('input[name="strategy"]').forEach(radio => {
            radio.addEventListener('change', () => {
                perfAuditState.strategy = radio.value;
                // Update visual state
                document.querySelectorAll('.strategy-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                radio.closest('.strategy-option').classList.add('active');
            });
        });

        // Run audit button
        document.querySelector('.btn-run-audit')?.addEventListener('click', runPerfAudit);
    }

    /**
     * Run performance audit
     */
    async function runPerfAudit() {
        const domain = perfAuditState.domain;
        const strategy = perfAuditState.strategy;

        // Update button state
        const btn = document.querySelector('.btn-run-audit');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Running...';
        }

        // Show loading in results area
        const resultsDiv = document.querySelector('.perf-audit-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="perf-audit-loading">
                    <div class="loading-spinner"></div>
                    <p>Running PageSpeed Insights audit...</p>
                    <p class="text-muted">This may take up to 60 seconds.</p>
                </div>
            `;
        }

        const result = await api('run_perf_audit', {
            domain: domain,
            strategy: strategy
        });

        // Restore button
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🚀 Run Audit';
        }

        if (!result) {
            showToast('Failed to run performance audit: Network error', 'error');
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <div class="perf-audit-error">
                        <p>Failed to connect to the server. Please try again.</p>
                    </div>
                `;
            }
            return;
        }

        if (result.success && result.audit) {
            perfAuditState.result = result.audit;
            if (resultsDiv) {
                resultsDiv.innerHTML = renderPerfAuditResults(result.audit);
            }
            showToast(`Performance audit completed for ${domain}`, 'success');
        } else {
            showToast('Performance audit failed: ' + (result.error || 'Unknown error'), 'error');
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <div class="perf-audit-error">
                        <p>${escapeHtml(result.error || 'Unknown error')}</p>
                        ${result.output ? `<pre>${escapeHtml(result.output)}</pre>` : ''}
                    </div>
                `;
            }
        }
    }

    // ============================================
    // Auto Refresh
    // ============================================

    /**
     * Start auto refresh
     */
    function startAutoRefresh() {
        if (CONFIG.autoRefresh > 0) {
            refreshInterval = setInterval(() => {
                loadServerStatus();
            }, CONFIG.autoRefresh * 1000);
        }
    }

    /**
     * Stop auto refresh
     */
    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    }

    // ============================================
    // Initialization
    // ============================================

    /**
     * Initialize the application
     */
    function init() {
        // Load initial data
        loadServerStatus();
        loadSites();
        loadActivityLog();
        loadMonitorStatus();

        // Start auto refresh
        startAutoRefresh();

        // Attach header button listeners
        document.getElementById('btn-refresh-status')?.addEventListener('click', loadServerStatus);
        document.getElementById('btn-full-audit')?.addEventListener('click', showFullAudit);
        document.getElementById('btn-refresh-sites')?.addEventListener('click', loadSites);
        document.getElementById('btn-refresh-activity')?.addEventListener('click', loadActivityLog);

        // Quick action buttons
        document.getElementById('btn-restart-ols')?.addEventListener('click', restartOLS);
        document.getElementById('btn-run-audit')?.addEventListener('click', showFullAudit);
        document.getElementById('btn-git-pull')?.addEventListener('click', gitPull);
        document.getElementById('btn-deploy-site')?.addEventListener('click', showDeploySiteModal);
        document.getElementById('btn-save-snapshot')?.addEventListener('click', saveAuditSnapshot);
        document.getElementById('btn-compare-drift')?.addEventListener('click', compareDrift);
        document.getElementById('btn-validate-all')?.addEventListener('click', validateAllSites);
        document.getElementById('btn-fm-assets')?.addEventListener('click', switchFMtoAssets);
        document.getElementById('btn-fm-sites')?.addEventListener('click', switchFMtoSites);

        // Monitor buttons
        document.getElementById('btn-refresh-monitor')?.addEventListener('click', loadMonitorStatus);
        document.getElementById('btn-run-monitor')?.addEventListener('click', runDailyMonitor);

        // Modal close handlers
        document.querySelector('.modal-close')?.addEventListener('click', hideModal);
        document.querySelector('.modal-backdrop')?.addEventListener('click', hideModal);

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideModal();
            }
        });

        // Stop auto refresh when page is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                startAutoRefresh();
                loadServerStatus();
            }
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
