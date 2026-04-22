# _plugins/maintenance_gate.rb
#
# Build /maintenance/ only when site.maintenance.enabled is truthy in
# _config.yml. When disabled, drop the page from the Jekyll pages list
# during :site :post_read so it never renders or gets written to _site/.

Jekyll::Hooks.register :site, :post_read do |site|
  enabled = site.config.dig('maintenance', 'enabled')
  next if enabled

  removed = site.pages.reject! do |p|
    p.name == 'maintenance.html' || p.url == '/maintenance/'
  end

  Jekyll.logger.info 'MaintenanceGate:', 'dropped /maintenance/ (disabled in _config.yml)' if removed
end
