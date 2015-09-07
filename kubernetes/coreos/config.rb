if File.exists?('kubernetes-cluster.yaml') && ARGV[0].eql?('up')
  require 'open-uri'
  require 'yaml'

  data = YAML.load(IO.readlines('kubernetes-cluster.yaml')[1..-1].join)

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
$num_instances = 3
$vb_memory = 2048
$vb_cpus = 2
$update_channel = 'stable'
