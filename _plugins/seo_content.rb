require 'cgi'
require 'json'

module MirrorSEO
  def self.summary(markdown, converter, limit = 200)
    html = converter.convert(markdown.to_s)
    html = html.gsub(/<(script|style)\b[^>]*>.*?<\/\1>/mi, '')
               .gsub(/<h[1-6]\b[^>]*>.*?<\/h[1-6]>/mi, '')
               .gsub(/<[^>]+>/, ' ')
    text = CGI.unescapeHTML(html).gsub(/[[:space:]]+/, ' ').strip
    text.length > limit ? text[0, limit] + '…' : text
  end

  module Filters
    # A JSON script is HTML raw text; escape '<' so content cannot close it.
    def script_json(value)
      jsonify(value).gsub('<', '\\u003c').gsub('>', '\\u003e').gsub('&', '\\u0026')
    end
  end

  class ContentGenerator < Jekyll::Generator
    priority :low

    def generate(site)
      converter = site.find_converter_instance(Jekyll::Converters::Markdown)
      posts = site.posts.docs.select { |post| Array(post.data['categories']).include?('news') }.sort_by(&:date).reverse
      posts.each do |post|
        explicit = post.data['description'] || post.data['summary']
        explicit ||= post.data['excerpt'] if post.data['excerpt'].is_a?(String)
        post.data['seo_description'] = MirrorSEO.summary(explicit || post.content, converter)
        post.data['excerpt'] = post.data['seo_description']
      end

      news = site.pages.find { |page| page.url == '/news/' }
      if news
        count = [(posts.size / 10.0).ceil, 1].max
        links = (1..count).map { |number| { 'number' => number, 'url' => number == 1 ? '/news/' : "/news/page#{number}/" } }
        raw_content = news.content.dup
        raw_data = news.data.dup
        links.each do |link|
          number = link['number']
          page = news
          if number > 1
            page = Jekyll::PageWithoutAFile.new(site, site.source, "news/page#{number}", 'index.html')
            page.content = raw_content
            page.data = raw_data.merge('permalink' => link['url'], 'title' => "新闻公告 · 第 #{number} 页")
            site.pages << page
          end
          page.data['news_posts'] = posts.slice((number - 1) * 10, 10) || []
          page.data['news_pages'] = links
          page.data['news_page'] = number
        end
      end

      help = site.collections['help']&.docs || []
      help.each do |doc|
        name = doc.data.dig('zconf', 'name') || doc.basename_without_ext
        doc.data['title'] = "#{name} 使用帮助"
        doc.data['seo_description'] = "#{name} 镜像源使用帮助：配置方法与示例。#{site.config['title']}。"
        target = doc.data.dig('zconf', 'redirect_help_id')
        next unless target && help.any? { |item| item.data.dig('zconf', 'name') == target }
        doc.data['canonical_path'] = "/help/#{target}/"
        doc.data['sitemap'] = false
      end

      options = site.data['options'] || {}
      descriptions = Array(options['mirror_desc']).to_h { |item| [item['name'], item['desc']] }
      # Descriptions are a catalog, not proof a mirror is served. Prefer the build snapshot.
      snapshot = File.join(site.source, 'static/tunasync.json')
      mirrors = File.exist?(snapshot) ? JSON.parse(File.read(snapshot)) : []
      mirrors = [] unless mirrors.is_a?(Array)
      mirrors += Array(options['unlisted_mirrors'])
      mirrors = help.map { |doc| { 'name' => doc.data.dig('zconf', 'name') } } if mirrors.empty?
      help_urls = help.to_h { |doc| [doc.data.dig('zconf', 'name'), doc.url] }
      git = Array(options['git_mirrors'])
      force_help = Array(options['force_redirect_help_mirrors'])
      site.data['static_mirrors'] = mirrors.select { |item| item.is_a?(Hash) && !item['name'].to_s.strip.empty? }.uniq { |item| item['name'] }.sort_by { |item| item['name'].downcase }.map do |item|
        name = item['name']
        help_url = help_urls[name]
        url = if git.include?(name)
                help_url || "/git/#{name}/"
              elsif force_help.include?(name) && help_url
                help_url
              else
                item['url'] || "/#{name}/"
              end
        { 'name' => name, 'description' => descriptions[name], 'url' => url, 'help_url' => help_url }
      end

      site.pages.each do |page|
        if page.url.start_with?('/fancy-index/') || ['/404.html', '/maintenance/'].include?(page.url)
          page.data['sitemap'] = false
          page.data['robots'] = 'noindex, follow'
        end
      end
    end
  end
end
Liquid::Template.register_filter(MirrorSEO::Filters)
