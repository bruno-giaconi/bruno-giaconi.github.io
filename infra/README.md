# Essai ponctuel du démonstrateur sur Azure AKS

Le modèle Bicep décrit un cluster AKS de test de niveau Free avec deux nœuds Linux, une identité managée et un accès à l’API Kubernetes limité à une IPv4 publique. Le service de démonstration reste en `ClusterIP`. Le niveau Free couvre le plan de contrôle. Les nœuds, les disques, l’équilibrage de charge sortant et l’IP publique associée peuvent être facturés. [Tarification AKS](https://azure.microsoft.com/en-us/pricing/details/kubernetes-service/) · [Exigences des pools système](https://learn.microsoft.com/en-us/azure/aks/use-system-pools)

## Compiler sans abonnement

```bash
bicep build --no-restore infra/aks-dev.bicep --stdout
```

Cette étape génère le modèle ARM. Le pipeline applicatif teste le même manifeste dans `kind`, sur un cluster éphémère. L’essai Azure ci-dessous est distinct.

## 1. Préflight en lecture seule

Lancer les commandes depuis la racine du démonstrateur, sous Bash avec `az` et Python 3.9 ou ultérieur. Utiliser une session Azure Cloud Shell éphémère ou un terminal local connecté à Azure. La session Cloud Shell éphémère requiert l’enregistrement de `Microsoft.CloudShell` et fonctionne sans créer de partage de fichiers. [Cloud Shell éphémère](https://learn.microsoft.com/azure/cloud-shell/get-started/ephemeral)

```bash
subscription='<UUID de l’abonnement autorisé>'
region='switzerlandnorth'
sku='Standard_D4s_v5'

bash infra/aks-stage.sh --preflight \
  --subscription "$subscription" --region "$region" --sku "$sku"
```

Le préflight vérifie l’état de l’abonnement, les fournisseurs `Microsoft.ContainerService`, `Microsoft.Compute` et `Microsoft.Network`, les restrictions du SKU et le quota régional et familial. Deux nœuds `Standard_D4s_v5` nécessitent huit vCPU disponibles à chacun des deux niveaux. L’ajout facultatif de `--image` contrôle l’accès anonyme au digest GHCR. [Quotas vCPU](https://learn.microsoft.com/en-us/azure/virtual-machines/quotas)

Pour l’application réelle, prévoir un rôle permettant de créer et de supprimer le groupe dédié, d’écrire les ressources AKS et de récupérer le kubeconfig administrateur, comme Contributor au niveau de l’abonnement. Les contrôles du préflight se font avec les autorisations de lecture correspondantes. L’enregistrement d’un fournisseur nécessite une autorisation supplémentaire au niveau de l’abonnement. [Droits pour Bicep](https://learn.microsoft.com/en-us/azure/aks/learn/quick-kubernetes-deploy-bicep) · [Droits kubeconfig](https://learn.microsoft.com/en-us/azure/aks/control-kubeconfig-access)

## 2. Déploiement après validation du coût

Estimer les deux nœuds, les disques et les ressources réseau dans le [calculateur Azure](https://azure.microsoft.com/en-us/pricing/calculator/), puis renseigner une estimation positive et le montant maximal accepté, en CHF. Le script compare ces montants avant la première mutation. Cette comparaison sert de garde de lancement. Les alertes de budget Azure signalent le dépassement et la facturation suit les ressources consommées. [Budgets Azure](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets)

Prérequis supplémentaires pour cette étape : `kubectl`, `ssh-keygen`, un digest de l’image publique GHCR construite à partir du démonstrateur et l’IPv4 publique **du terminal qui exécutera `kubectl`**. L’IPv4 d’une session Cloud Shell peut différer de celle du poste qui ouvre le navigateur. La clé SSH et le kubeconfig d’essai sont isolés dans un répertoire temporaire. [Adresses autorisées AKS](https://learn.microsoft.com/en-us/azure/aks/api-server-authorized-ip-ranges) · [Registre GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

```bash
image='ghcr.io/<owner>/<image>@sha256:<digest complet>'
admin_ipv4='<IPv4 publique du terminal>'
estimated_chf='<estimation en CHF>'
approved_max_chf='<montant maximal accepté en CHF>'

bash infra/aks-stage.sh --apply --confirm-cost \
  --subscription "$subscription" --region "$region" --sku "$sku" \
  --image "$image" --admin-ip "$admin_ipv4" \
  --estimated-cost-chf "$estimated_chf" --max-cost-chf "$approved_max_chf"
```

Le script crée un groupe unique `rg-pv-demo-<id>` avec un tag d’appartenance, exécute le `what-if`, déploie le cluster, vérifie les nœuds et la disponibilité du déploiement Kubernetes, puis lance le scénario HTTP du projet via une redirection locale. Le scénario vérifie les sources des actions, une échéance absente et la validation humaine en mode `fixture`.

À la sortie, y compris après une erreur ou un signal géré, le script vérifie son tag avant de supprimer uniquement le groupe d’essai. AKS supprime son groupe de nœuds. Le script vérifie l’absence des deux groupes et indique les noms exacts en cas de contrôle manuel nécessaire. Après une interruption forcée ou une déconnexion, vérifier ces groupes dans le portail Azure. [Groupes de ressources AKS](https://learn.microsoft.com/en-us/azure/aks/faq#why-are-two-resource-groups-created-with-aks)
