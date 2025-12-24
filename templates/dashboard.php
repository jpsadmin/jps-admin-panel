<?php
/**
 * JPS Admin Panel - Dashboard Template
 */

defined('JPS_ADMIN') or die('Direct access not permitted');
?>

<div class="dashboard-grid">
    <!-- Server Health Panel -->
    <section class="panel server-health-panel">
        <div class="panel-header">
            <h2 class="panel-title">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                Server Health
            </h2>
            <div class="panel-actions">
                <button type="button" class="btn btn-sm btn-secondary" id="btn-refresh-status" title="Refresh">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
                <button type="button" class="btn btn-sm btn-primary" id="btn-full-audit" title="Full Audit">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Full Audit
                </button>
            </div>
        </div>
        <div class="panel-body">
            <div class="health-grid" id="health-stats">
                <div class="health-item">
                    <div class="health-label">CPU</div>
                    <div class="health-bar">
                        <div class="health-bar-fill status-ok" id="cpu-bar" style="width: 0%"></div>
                    </div>
                    <div class="health-value" id="cpu-value">--</div>
                </div>
                <div class="health-item">
                    <div class="health-label">Memory</div>
                    <div class="health-bar">
                        <div class="health-bar-fill status-ok" id="memory-bar" style="width: 0%"></div>
                    </div>
                    <div class="health-value" id="memory-value">--</div>
                </div>
                <div class="health-item">
                    <div class="health-label">Disk</div>
                    <div class="health-bar">
                        <div class="health-bar-fill status-ok" id="disk-bar" style="width: 0%"></div>
                    </div>
                    <div class="health-value" id="disk-value">--</div>
                </div>
            </div>
            <div class="services-grid" id="services-status">
                <div class="service-item" id="service-ols">
                    <span class="service-indicator status-unknown"></span>
                    <span class="service-name">OpenLiteSpeed</span>
                </div>
                <div class="service-item" id="service-mariadb">
                    <span class="service-indicator status-unknown"></span>
                    <span class="service-name">MariaDB</span>
                </div>
                <div class="service-item" id="service-fail2ban">
                    <span class="service-indicator status-unknown"></span>
                    <span class="service-name">Fail2ban</span>
                </div>
            </div>
        </div>
    </section>

    <!-- Quick Actions Panel -->
    <section class="panel quick-actions-panel">
        <div class="panel-header">
            <h2 class="panel-title">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                Quick Actions
            </h2>
        </div>
        <div class="panel-body">
            <div class="actions-grid">
                <button type="button" class="action-btn" id="btn-restart-ols" data-action="restart_ols">
                    <span class="action-icon">&#x1F504;</span>
                    <span class="action-label">Restart OpenLiteSpeed</span>
                </button>
                <button type="button" class="action-btn" id="btn-run-audit" data-action="run_audit">
                    <span class="action-icon">&#x1F4CA;</span>
                    <span class="action-label">Run Full Audit</span>
                </button>
                <button type="button" class="action-btn" id="btn-git-pull" data-action="git_pull">
                    <span class="action-icon">&#x1F504;</span>
                    <span class="action-label">Pull Git Updates</span>
                </button>
            </div>
        </div>
    </section>

    <!-- Sites Table Panel -->
    <section class="panel sites-panel full-width">
        <div class="panel-header">
            <h2 class="panel-title">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                Sites
            </h2>
            <div class="panel-actions">
                <button type="button" class="btn btn-sm btn-secondary" id="btn-refresh-sites" title="Refresh Sites">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Refresh
                </button>
            </div>
        </div>
        <div class="panel-body">
            <div class="table-wrapper">
                <table class="sites-table" id="sites-table">
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Size</th>
                            <th>WP Version</th>
                            <th>SSL Expiry</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="sites-tbody">
                        <tr>
                            <td colspan="6" class="loading-row">
                                <div class="inline-spinner"></div>
                                Loading sites...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- Recent Activity Panel -->
    <section class="panel activity-panel full-width">
        <div class="panel-header">
            <h2 class="panel-title">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Recent Activity
            </h2>
            <div class="panel-actions">
                <button type="button" class="btn btn-sm btn-secondary" id="btn-refresh-activity" title="Refresh">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="panel-body">
            <div class="activity-log" id="activity-log">
                <div class="loading-row">
                    <div class="inline-spinner"></div>
                    Loading activity log...
                </div>
            </div>
        </div>
    </section>
</div>
