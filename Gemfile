source 'https://rubygems.org'

gem 'jekyll', '~> 4.3', '>= 4.3.3'

group :jekyll_deps do
    gem 'bigdecimal', '~> 3.1'
    gem 'csv', '~> 3.3'
    gem 'base64', '~> 0.2.0'
    gem 'webrick', '~> 1.8'
end

group :jekyll_plugins do
    gem 'jekyll-paginate', '~> 1.1'
    gem 'jekyll-sitemap', '~> 1.4'
    gem 'jekyll-seo-tag', '~> 2.8'
    gem 'jekyll-feed', '~> 0.17'
    
    gem 'jekyll-relative-links', '~> 0.7.0'
    gem 'jekyll-titles-from-headings', '~> 0.5.3'
    gem 'jekyll-redirect-from', '~> 0.16'
    
    gem 'jekyll-minifier', '~> 0.1.10'
end

platforms :mingw, :x64_mingw, :mswin, :jruby do
    gem 'tzinfo', '>= 1', '< 3'
    gem 'tzinfo-data'
end

gem 'wdm', '~> 0.1.1', platforms: [:mingw, :x64_mingw, :mswin]

gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]
