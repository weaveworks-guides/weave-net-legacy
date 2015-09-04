# Automatically set the discovery token on 'vagrant up'

if File.exists?('kubernetes-cluster.yaml') && ARGV[0].eql?('up')
  require 'open-uri'
  require 'yaml'

  data = YAML.load(IO.readlines('kubernetes-cluster.yaml')[1..-1].join)

  #token = open('https://discovery.etcd.io/new').read
  #data['coreos']['etcd2']['discovery'] = token

  if ENV['TEST_WEAVE_IMAGES_FROM'] then
    data['write_files'] << {
      'path' => '/etc/weave.env',
      'owner' => 'root',
      'permissions' => '0644',
      'content' => 'VERSION="latest"',
    }
    ## This looks like it should work, but seems like cloudinit doesn't like
    ## the file size and is generally quite picky... maybe it's Go's b64 codec.
    # require 'base64'
    # require 'zlib'
    # io = StringIO.new('w')
    # gz = Zlib::GzipWriter.new(io)
    # gz.write(open("#{ENV['TEST_WEAVE_IMAGES_FROM']}/weave.tar").read)
    # gz.close
    # data['write_files'] << {
    #   'path' => "/tmp/weave.tar",
    #   'owner' => 'root',
    #   'permissions' => '0644',
    #   'encoding' => 'gzip+base64',
    #   'content' => Base64.strict_encode64(io.string)
    # }
  end

  if Dir.exists?('addons')
    Dir.foreach('addons').select {|x| x =~ /.*\.yaml/}.each do |f|
       data['write_files'] << {
        'path' => "/etc/kubernetes/addons/#{f}",
        'owner' => 'root',
        'permissions' => '0644',
        'content' => open(File.join('addons', f)).readlines.join
      }
    end
  end

  lines = YAML.dump(data).split("\n")
  lines[0] = '#cloud-config'

  open('user-data', 'w') do |f|
    f.puts(lines.join("\n"))
  end
end

$instance_name_prefix = 'kube'
$num_instances=3
$vb_memory = 2048
$vb_cpus = 2
$update_channel = 'stable'

if ENV['TEST_WEAVE_IMAGES_FROM'] then
  Vagrant.configure("2") do |config|
    config.vm.provision :file, :source => ENV['TEST_WEAVE_IMAGES_FROM'], :destination => "/tmp/weave.tar"
  end
end
