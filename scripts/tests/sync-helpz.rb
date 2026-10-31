require 'yaml'
require 'tmpdir'
require 'fileutils'
require 'open3'
require 'shellwords'

workflow = YAML.load_file(File.expand_path('../../.github/workflows/sync-helpz.yml', __dir__))
events = workflow['on'] || workflow[true]
def assert(value, message)
  raise message unless value
end

def git(dir, *args)
  out, err, status = Open3.capture3('git', '-C', dir, *args)
  raise "git #{args.join(' ')}: #{err}" unless status.success?
  out.strip
end

assert(events.dig('push', 'branches') == ['main'], 'Merged main updates must trigger synchronization')
assert(events.dig('push', 'paths').include?('_helpz/global'), 'Help submodule changes must trigger synchronization')
upstream = workflow.fetch('jobs').fetch('sync')
assert(upstream.fetch('if').include?("github.event_name != 'push'"), 'A merged update must not create another upstream PR')
checkout = upstream.fetch('steps').find { |step| step.fetch('uses', '').start_with?('actions/checkout@') }
assert(checkout.dig('with', 'ref') == 'main', 'Upstream review must target main regardless of dispatch branch')
pr = upstream.fetch('steps').find { |step| step.fetch('uses', '').include?('create-pull-request@') }
assert(pr.dig('with', 'base') == 'main', 'Upstream PR base must be explicit')

job = workflow.fetch('jobs').fetch('sync-nyist')
assert(job.dig('concurrency', 'cancel-in-progress') == false, 'Concurrent syncs must not interrupt a push')
assert(job.dig('permissions', 'actions') == 'write', 'Bot pushes need explicit build dispatch permission')
step = job.fetch('steps').find { |item| item['id'] == 'sync' }
assert(step, 'Missing branch synchronization step')
build = job.fetch('steps').find { |item| item.fetch('run', '').include?('gh workflow run build.yml') }
assert(build && build.fetch('if').include?("steps.sync.outputs.changed == 'true'"), 'Only changed bot pushes should dispatch the site build')
assert(build.fetch('run').include?('--ref nyist-web'), 'Build dispatch must target nyist-web')

Dir.mktmpdir('helpz-sync-test-') do |tmp|
  origin, seed, child, runner = %w[origin.git seed child runner].map { |name| File.join(tmp, name) }
  [seed, child].each do |dir|
    FileUtils.mkdir_p(dir)
    git(dir, 'init', '-q', '-b', 'main')
    git(dir, 'config', 'user.name', 'Fixture')
    git(dir, 'config', 'user.email', 'fixture@example.invalid')
  end
  revisions = []
  %w[old approved unreviewed].each do |name|
    File.write(File.join(child, 'help.txt'), name)
    git(child, 'add', 'help.txt')
    git(child, 'commit', '-qm', name)
    revisions << git(child, 'rev-parse', 'HEAD')
  end
  File.write(File.join(seed, '_config.yml'), 'hostname: mirrors.ha.edu.cn')
  git(seed, 'add', '_config.yml')
  git(seed, 'update-index', '--add', '--cacheinfo', '160000', revisions[0], '_helpz/global')
  git(seed, 'commit', '-qm', 'Initial help')
  stale_main = git(seed, 'rev-parse', 'HEAD')
  git(seed, 'checkout', '-qb', 'nyist-web')
  nyist_config = 'hostname: mirror.nyist.edu.cn'
  File.write(File.join(seed, '_config.yml'), nyist_config)
  git(seed, 'add', '_config.yml')
  git(seed, 'commit', '-qm', 'Independent site configuration')
  before = git(seed, 'rev-parse', 'HEAD')
  git(seed, 'checkout', '-q', 'main')
  File.write(File.join(seed, 'main-only.txt'), 'Do not copy this file to the other site')
  git(seed, 'add', 'main-only.txt')
  git(seed, 'update-index', '--cacheinfo', '160000', revisions[1], '_helpz/global')
  git(seed, 'commit', '-qm', 'Approved help update')
  approved_main = git(seed, 'rev-parse', 'HEAD')
  git(seed, 'checkout', '-qb', 'helpz')
  git(seed, 'update-index', '--cacheinfo', '160000', revisions[2], '_helpz/global')
  git(seed, 'commit', '-qm', 'Unreviewed help update')
  FileUtils.mkdir_p(origin)
  git(origin, 'init', '--bare', '-q', '-b', 'main')
  git(seed, 'remote', 'add', 'origin', origin)
  git(seed, 'push', '-q', 'origin', 'main', 'nyist-web', 'helpz')
  out, err, status = Open3.capture3('git', 'clone', '-q', '--branch', 'nyist-web', origin, runner)
  raise err unless status.success?

  output = File.join(tmp, 'output')
  run = lambda do
    File.write(output, '')
    out, err, status = Open3.capture3({ 'GITHUB_OUTPUT' => output, 'GITHUB_SHA' => stale_main },
      'bash', '-euo', 'pipefail', '-c', step.fetch('run'), chdir: runner)
    raise "Synchronization failed: #{out}\n#{err}" unless status.success?
    File.read(output)
  end
  assert(run.call.include?('changed=true'), 'An approved update must be pushed')
  after = git(origin, 'rev-parse', 'nyist-web')
  assert(git(origin, 'diff', '--name-only', before, after) == '_helpz/global', 'Only the help pointer may change')
  assert(git(origin, 'ls-tree', 'nyist-web', '_helpz/global').split[2] == revisions[1], 'Use approved main, not the unreviewed upstream or an older event')
  assert(git(origin, 'show', 'nyist-web:_config.yml') == nyist_config, 'Keep the independent site configuration')
  assert(git(origin, 'rev-parse', 'main') == approved_main, 'Do not modify main during propagation')
  assert(run.call.include?('changed=false'), 'An already synchronized branch must be a no-op')
  assert(git(origin, 'rev-parse', 'nyist-web') == after, 'Do not create empty synchronization commits')

  # A human push between checkout and push must survive the retry.
  git(seed, 'checkout', '-q', 'main')
  git(seed, 'update-index', '--cacheinfo', '160000', revisions[2], '_helpz/global')
  git(seed, 'commit', '-qm', 'Approve the next update')
  git(seed, 'push', '-q', 'origin', 'main')
  racer = File.join(tmp, 'racer')
  out, err, status = Open3.capture3('git', 'clone', '-q', '--branch', 'nyist-web', origin, racer)
  raise err unless status.success?
  git(racer, 'config', 'user.name', 'Fixture')
  git(racer, 'config', 'user.email', 'fixture@example.invalid')
  concurrent_config = nyist_config + "\nconcurrent: true"
  File.write(File.join(racer, '_config.yml'), concurrent_config)
  git(racer, 'add', '_config.yml')
  git(racer, 'commit', '-qm', 'Concurrent site edit')
  flag = File.join(tmp, 'race-fired')
  hook = File.join(runner, '.git/hooks/pre-push')
  File.write(hook, <<~SH)
    #!/bin/bash
    set -euo pipefail
    unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
    if [[ ! -f #{Shellwords.escape(flag)} ]]; then
      touch #{Shellwords.escape(flag)}
      git -C #{Shellwords.escape(racer)} push -q origin HEAD:refs/heads/nyist-web
    fi
  SH
  File.chmod(0755, hook)
  assert(run.call.include?('changed=true'), 'Retry after a concurrent branch update')
  assert(File.exist?(flag), 'The concurrent writer must actually run')
  assert(git(origin, 'show', 'nyist-web:_config.yml') == concurrent_config, 'Keep concurrent site edits')
  assert(git(origin, 'rev-parse', 'nyist-web^') == git(racer, 'rev-parse', 'HEAD'), 'Build on the concurrent writer instead of overwriting it')
  assert(git(origin, 'ls-tree', 'nyist-web', '_helpz/global').split[2] == revisions[2], 'Publish the latest approved revision after retry')
end
puts 'PASS approved help propagation, branch isolation, stale events, concurrent pushes, build dispatch and no-op behavior'
