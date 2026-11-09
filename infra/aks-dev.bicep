targetScope = 'resourceGroup'

@description('Nom du cluster de développement.')
@minLength(3)
@maxLength(40)
param clusterName string = 'aks-pv-demo-dev'

@description('Région où créer le cluster. Vérifier la disponibilité et le quota du SKU.')
param location string = resourceGroup().location

@description('SKU du nœud système Linux, avec au moins 4 vCPU.')
param nodeVmSize string = 'Standard_D4s_v5'

@description('Adresse IPv4 publique de la machine de test, sans suffixe CIDR.')
@minLength(7)
@maxLength(15)
param adminIpv4 string

@description('Identifiant administrateur du nœud Linux.')
param nodeAdminUsername string

@description('Clé SSH publique temporaire du nœud Linux.')
param sshPublicKey string

resource aks 'Microsoft.ContainerService/managedClusters@2025-10-01' = {
  name: clusterName
  location: location
  tags: {
    environment: 'dev'
    purpose: 'pv-demo'
  }
  sku: {
    name: 'Base'
    tier: 'Free'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: '${clusterName}-${uniqueString(resourceGroup().id)}'
    enableRBAC: true
    apiServerAccessProfile: {
      authorizedIPRanges: [
        '${adminIpv4}/32'
      ]
    }
    linuxProfile: {
      adminUsername: nodeAdminUsername
      ssh: {
        publicKeys: [
          {
            keyData: sshPublicKey
          }
        ]
      }
    }
    agentPoolProfiles: [
      {
        name: 'system'
        count: 1
        mode: 'System'
        osType: 'Linux'
        osDiskType: 'Managed'
        osDiskSizeGB: 32
        vmSize: nodeVmSize
        type: 'VirtualMachineScaleSets'
        enableNodePublicIP: false
      }
    ]
    networkProfile: {
      networkPlugin: 'azure'
      networkPluginMode: 'overlay'
      loadBalancerSku: 'standard'
      outboundType: 'loadBalancer'
    }
  }
}

output clusterResourceId string = aks.id
