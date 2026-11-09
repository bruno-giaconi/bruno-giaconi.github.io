# Cluster AKS de démonstration

Le modèle `aks-dev.bicep` décrit un cluster de test à un nœud Linux, avec identité managée, accès à l’API Kubernetes limité à l’adresse IPv4 indiquée et aucune IP publique sur les nœuds. Le niveau Free concerne le plan de contrôle. Le nœud, le disque et les ressources réseau peuvent être facturés. Vérifier le prix et le quota du SKU dans la région avant tout essai. [Tarification AKS](https://azure.microsoft.com/en-us/pricing/details/kubernetes-service/) · [Exigences des nœuds système](https://learn.microsoft.com/en-us/azure/aks/use-system-pools)

## Compiler sans abonnement Azure

```shell
bicep build --no-restore infra/aks-dev.bicep --stdout
```

La compilation vérifie le modèle et génère sa représentation ARM. Le pipeline effectue ce contrôle sans déployer. Le test applicatif automatisé utilise `kind`.

## Essai Azure ponctuel

Ces commandes Bash sont à lancer depuis la racine du dépôt, après validation du coût. Il faut être connecté au bon abonnement Azure et exécuter `kubectl` depuis la même sortie réseau que celle renseignée dans `ADMIN_IPV4`.

```bash
set -euo pipefail
region='switzerlandnorth'
rg="rg-pv-demo-$(date -u +%Y%m%d%H%M%S)-${RANDOM}"
cluster='aks-pv-demo-dev'
node_admin="pvops${RANDOM}"
: "${ADMIN_IPV4:?Renseigner l’adresse IPv4 publique de la machine de test}"
: "${SSH_PUBLIC_KEY_PATH:?Renseigner le chemin de la clé publique temporaire}"

az account show --query '{subscription:name}' -o table
az group create --name "$rg" --location "$region"
az deployment group what-if --resource-group "$rg" \
  --template-file infra/aks-dev.bicep --parameters "clusterName=$cluster" \
  "adminIpv4=$ADMIN_IPV4" "nodeAdminUsername=$node_admin" "sshPublicKey=$(cat "$SSH_PUBLIC_KEY_PATH")"
```

Après vérification du plan et du groupe dédié, reprendre dans la même session :

```bash
az deployment group create --resource-group "$rg" \
  --template-file infra/aks-dev.bicep --parameters "clusterName=$cluster" \
  "adminIpv4=$ADMIN_IPV4" "nodeAdminUsername=$node_admin" "sshPublicKey=$(cat "$SSH_PUBLIC_KEY_PATH")"

kubeconfig_dir=$(mktemp -d)
az aks get-credentials --resource-group "$rg" --name "$cluster" \
  --admin --file "$kubeconfig_dir/config"
kubectl --kubeconfig "$kubeconfig_dir/config" get nodes
```

Le test ci-dessus valide le cluster. Pour y faire tourner le démonstrateur, publier d’abord son image fictive dans un registre approuvé accessible à AKS, puis adapter la référence d’image et la politique de chargement du manifeste `k8s/demo.yaml`. L’accès à l’application peut rester local via `kubectl port-forward`.

Supprimer le groupe dédié après l’essai, même si le déploiement échoue. Vérifier le nom avant la suppression :

```bash
printf '%s\n' "$rg"
az group delete --name "$rg" --yes
az group exists --name "$rg"
```

Résultat attendu pour la dernière commande : `false`. La suppression normale du cluster prend aussi en charge le groupe des nœuds créé par AKS. [Groupes de ressources AKS](https://learn.microsoft.com/en-us/azure/aks/faq#why-are-two-resource-groups-created-with-aks)
