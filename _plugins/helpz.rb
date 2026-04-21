# _plugins/helpz.rb
#
# Invokes _helpz/generate.mjs during Jekyll build and registers the
# generated files as a Jekyll collection (default label "help").
# Adapted from tuna/mirror-web/_plugins/helpz.rb.

require 'open3'
require 'json'
require 'jekyll/filters'

module Jekyll
  module Zhelp
  end
end

class Jekyll::Zhelp::Generator < Jekyll::Generator
  safe false
  priority :highest

  class HelpzCollection < Jekyll::Collection
    def initialize(site, metadata, output_dir)
      @site = site
      @metadata = metadata
      @relative_directory = output_dir
      @label = sanitize_label(metadata['label'] || 'help')
    end

    def write?
      true
    end

    def relative_directory
      @relative_directory
    end

    def directory
      @directory ||= site.in_source_dir(relative_directory)
    end

    def filtered_entries
      entries
    end

    def to_liquid
      super.to_h
    end
  end

  class JekyllFilters
    include Jekyll::Filters
  end

  def generate(site)
    cache_dir = site.config['cache_dir'] || '.jekyll-cache'
    helpz_config = site.config['helpz'] || {}
    collection_config = helpz_config['collection'] || {}
    helpz_dir = helpz_config['dir'] || '_helpz'
    generator_script = helpz_config['generator'] || 'generate.mjs'
    enabled_pages_file = helpz_config['enabled_pages_file'] || 'enabled.yaml'
    enabled_pages_path = site.in_source_dir(File.join(helpz_dir, enabled_pages_file))

    unless helpz_config['language']
      Jekyll.logger.error 'Helpz:', "No 'helpz.language' in _config.yml"
      raise "helpz: missing language in _config.yml"
    end

    builder = site.in_source_dir(File.join(helpz_dir, generator_script))
    unless File.exist?(builder)
      Jekyll.logger.warn 'Helpz:', "generator not found at #{builder}, skipping"
      return
    end

    # Check Node.js is available
    begin
      Open3.capture2('node', '--version')
    rescue Errno::ENOENT
      Jekyll.logger.warn 'Helpz:', "'node' binary not found in PATH, skipping help generation"
      return
    end

    output_dir = File.join(cache_dir, 'helpz')

    cmd = ['node', builder,
           "--enabled-pages=#{enabled_pages_path}",
           "--output-dir=#{output_dir}",
           "--language=#{helpz_config['language']}",
           "--site-config=#{JekyllFilters.new.jsonify(site.config)}"]

    Jekyll.logger.info 'Helpz:', "Running: #{cmd.map { |c| c.include?(' ') ? c.inspect : c }.join(' ')}"

    status = Open3.popen3(*cmd) do |_stdin, stdout, stderr, wait_thr|
      Thread.new { stdout.each_line { |line| Jekyll.logger.info 'Helpz:', line.chomp } }
      Thread.new { stderr.each_line { |line| Jekyll.logger.warn 'Helpz:', line.chomp } }
      wait_thr.value
    end

    unless status.success?
      Jekyll.logger.error 'Helpz:', "generator exited with #{status.exitstatus}"
      raise "helpz: generator failed"
    end

    collection = HelpzCollection.new(site, collection_config, output_dir)
    collection.read
    site.collections[collection.label] = collection

    Jekyll.logger.info 'Helpz:', "registered #{collection.docs.length} help doc(s) as '#{collection.label}'"
  end
end
