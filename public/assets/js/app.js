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

    /**
     * Show deploy site modal
     */
    function showDeploySiteModal() {
        const content = `
            <div class="deploy-site-form">
                <div class="form-group">
                    <label for="deploy-domain-input">Domain Name:</label>
                    <input type="text" id="deploy-domain-input" placeholder="example.com" autocomplete="off">
                    <small>Enter the domain name for the new site (e.g., example.com)</small>
                </div>

                <div class="dialog-actions">
                    <button type="button" class="btn btn-secondary btn-cancel">Cancel</button>
                    <button type="button" class="btn btn-primary btn-deploy-confirm">
                        Deploy Site
                    </button>
                </div>
            </div>
        `;

        showModal('Deploy New Site', content);

        // Attach event listeners
        const input = document.getElementById('deploy-domain-input');
        const deployBtn = document.querySelector('.btn-deploy-confirm');
        const cancelBtn = document.querySelector('.btn-cancel');

        cancelBtn.addEventListener('click', hideModal);

        deployBtn.addEventListener('click', async () => {
            const domain = input.value.trim();
            if (!domain) {
                showToast('Please enter a domain name', 'warning');
                return;
            }

            hideModal();
            showLoading('Deploying site...');

            const result = await api('deploy_site', { domain: domain });

            hideLoading();

            if (!result || !result.success) {
                showToast('Failed to deploy site: ' + (result?.error || 'Unknown error'), 'error');
                return;
            }

            showToast('Site deployed successfully', 'success');
            showModal('Deploy Result', `<pre>${ansiToHtml(result.output || 'Site deployed')}</pre>`);
            loadSites();
        });

        // Allow Enter key to submit
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                deployBtn.click();
            }
        });

        // Focus the input
        input.focus();
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
