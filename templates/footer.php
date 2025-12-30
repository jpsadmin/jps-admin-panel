<?php
/**
 * JPS Admin Panel - Footer Template
 */

defined('JPS_ADMIN') or die('Direct access not permitted');

$config = get_config();
?>
    </main>
    <footer class="main-footer">
        <div class="footer-info">
            <p>&copy; <?php echo date('Y'); ?> JPS Hosting. All rights reserved.</p>
        </div>
    </footer>

    <!-- Modal Container -->
    <div id="modal-container" class="modal-container hidden">
        <div class="modal-backdrop"></div>
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title"></h3>
                <button type="button" class="modal-close">&times;</button>
            </div>
            <div class="modal-body"></div>
            <div class="modal-footer"></div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div id="loading-overlay" class="loading-overlay hidden">
        <div class="loading-spinner">
            <div class="spinner"></div>
            <span class="loading-text">Loading...</span>
        </div>
    </div>

    <!-- Toast Container -->
    <div id="toast-container" class="toast-container"></div>

    <script>
        // Pass config to JavaScript
        window.JPS_CONFIG = {
            autoRefresh: <?php echo (int)$config['auto_refresh']; ?>,
            csrfToken: '<?php echo h(generate_csrf_token()); ?>'
        };
    </script>
    <script src="assets/js/app.js"></script>
</body>
</html>
