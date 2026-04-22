# _plugins/robots.rb
#
# Emits _site/robots.txt with Disallow entries for every served mirror path,
# so crawlers don't index multi-terabyte mirror trees.
# Ported from tuna/mirror-web gen_robot.sh, sourcing from local build data
# (no live HTTP fetch) plus the redirects.json that jekyll-redirect-from
# writes during site.write.
#
# Runs on the :site :post_write hook so redirects.json is already on disk.

require 'json'
require 'yaml'
require 'set'

Jekyll::Hooks.register :site, :post_write do |site|
  host = site.config['hostname'] || 'mirrors.ha.edu.cn'
  names = Set.new

  # 1. Local data file: every mirror we describe in _data/options.yml.
  desc = site.data.dig('options', 'mirror_desc')
  desc.each { |m| names << m['name'].to_s if m.is_a?(Hash) && m['name'] } if desc.is_a?(Array)

  # 2. Enabled help pages (covers any mirror with a /help/<name>/ page).
  enabled_path = File.join(site.source, '_helpz', 'enabled.yaml')
  if File.exist?(enabled_path)
    enabled = YAML.load_file(enabled_path) rescue nil
    enabled.each { |n| names << n.to_s } if enabled.is_a?(Array)
  end

  # 3. redirects.json (jekyll-redirect-from). Use the first path segment of
  #    each key, e.g. "/ubuntu/foo/" -> "ubuntu", since we disallow at the
  #    mirror-root level.
  redirects_json = File.join(site.dest, 'redirects.json')
  if File.exist?(redirects_json)
    json = JSON.parse(File.read(redirects_json)) rescue nil
    if json.is_a?(Hash)
      json.each_key do |k|
        next if k.nil? || k.empty?
        seg = k.sub(%r{^/+}, '').split('/').first
        names << seg if seg && !seg.empty?
      end
    end
  end

  # 4. Static fallback — prefixes that are commonly served but not always
  #    listed as tunasync jobs. Matches the tuna reference script.
  %w[lede raspberry-pi-os ctan cygwin pub git linuxbrew-bottles].each { |n| names << n }

  names.delete('tuna')

  body = +"# robots.txt for https://#{host}\n"
  body << "User-agent: *\n\n"
  body << "Disallow: /logs\n"
  names.to_a.sort.each { |n| body << "Disallow: /#{n}\n" }

  FileUtils.mkdir_p(site.dest)
  File.write(File.join(site.dest, 'robots.txt'), body)
  Jekyll.logger.info 'Robots:', "wrote robots.txt with #{names.size + 1} Disallow entries"
end
