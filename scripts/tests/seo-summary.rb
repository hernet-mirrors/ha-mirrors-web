require 'bundler/setup'
require 'jekyll'
require_relative '../../_plugins/seo_content'

class SummaryTest
  def assert_equal(expected, actual)
    raise "Expected #{expected.inspect}, got #{actual.inspect}" unless expected == actual
  end
  def setup
    @converter = Jekyll::Converters::Markdown.new(Jekyll.configuration('quiet' => true))
  end
  def test_heading_is_not_the_preview
    text = MirrorSEO.summary("# A title\n\nActual **body** &amp; details.\n\nNext paragraph.", @converter)
    assert_equal 'Actual body & details. Next paragraph.', text
  end
  def test_unicode_length_and_scripts
    assert_equal '中' * 200 + '…', MirrorSEO.summary('中' * 201, @converter)
    assert_equal 'Body', MirrorSEO.summary("<script>alert('bad')</script>\n\nBody", @converter)
  end
  def test_short_article_is_not_padded
    assert_equal 'Brief announcement.', MirrorSEO.summary('Brief announcement.', @converter)
  end
end

test = SummaryTest.new
test.setup
test.test_heading_is_not_the_preview
test.test_unicode_length_and_scripts
test.test_short_article_is_not_padded
puts "PASS summary extraction, Unicode truncation, script removal and short articles"
