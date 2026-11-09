#!/usr/bin/env bash
if [[ ${BASH_SOURCE[0]} != "$0" ]]; then
  printf 'Lancer ce script avec bash, dans un processus séparé.\n' >&2
  return 2
fi
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash infra/aks-stage.sh --preflight --subscription UUID --region REGION --sku SKU
  bash infra/aks-stage.sh --apply --subscription UUID --region REGION --sku SKU \
    --image ghcr.io/OWNER/IMAGE@sha256:DIGEST --admin-ip IPV4 \
    --estimated-cost-chf MONTANT --max-cost-chf MONTANT --confirm-cost

--preflight vérifie les droits de lecture, la disponibilité et les quotas.
--apply facture potentiellement les ressources. La comparaison des estimations
est une garde de lancement, pas un plafond imposé à Azure.
EOF
}

fail() { printf 'Erreur : %s\n' "$*" >&2; exit 1; }

mode='' subscription='' region='' sku='' image='' admin_ip='' estimate='' max_cost='' confirmed=false
while (($#)); do
  case "$1" in
    --help) usage; exit 0 ;;
    --preflight|--apply)
      [[ -z $mode ]] || fail 'Choisir un seul mode.'
      mode=$1; shift ;;
    --confirm-cost) confirmed=true; shift ;;
    --subscription|--region|--sku|--image|--admin-ip|--estimated-cost-chf|--max-cost-chf)
      [[ $# -gt 1 && $2 != --* ]] || fail "Valeur manquante pour $1."
      case "$1" in
        --subscription) subscription=$2 ;;
        --region) region=$2 ;;
        --sku) sku=$2 ;;
        --image) image=$2 ;;
        --admin-ip) admin_ip=$2 ;;
        --estimated-cost-chf) estimate=$2 ;;
        --max-cost-chf) max_cost=$2 ;;
      esac
      shift 2 ;;
    *) fail "Option inconnue : $1" ;;
  esac
done

[[ -n $mode ]] || fail 'Choisir --preflight ou --apply.'
[[ $subscription =~ ^[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}$ ]] || fail 'Indiquer le UUID de l’abonnement.'
[[ $region =~ ^[a-z][a-z0-9]+$ ]] || fail 'Indiquer la région Azure, par exemple switzerlandnorth.'
[[ $sku =~ ^Standard_[A-Za-z0-9_]+$ ]] || fail 'Indiquer le SKU Azure complet.'
if [[ -n $image ]]; then
  [[ $image =~ ^ghcr\.io/[a-z0-9]+([._-][a-z0-9]+)*(/[a-z0-9]+([._-][a-z0-9]+)*)+@sha256:[0-9a-f]{64}$ ]] \
    || fail 'Fournir une image GHCR publique épinglée par son digest SHA-256.'
fi

for command in az python3; do command -v "$command" >/dev/null || fail "$command est requis."; done
if [[ $mode == --apply ]]; then
  [[ $confirmed == true && -n $image ]] || fail '--apply requiert --confirm-cost et une image publique épinglée.'
  for command in kubectl ssh-keygen; do command -v "$command" >/dev/null || fail "$command est requis."; done
  python3 - "$admin_ip" "$estimate" "$max_cost" <<'PY' || exit 1
from decimal import Decimal
from ipaddress import IPv4Address
import re
import sys

ip, estimate, maximum = sys.argv[1:]
try:
    ip = IPv4Address(ip)
except ValueError:
    sys.exit("Indiquer l’adresse IPv4 publique du client kubectl avec --admin-ip.")
if not ip.is_global or ip.is_multicast:
    sys.exit("--admin-ip doit être une IPv4 publique unicast.")
if not all(re.fullmatch(r"[0-9]+(?:\.[0-9]{1,2})?", amount) for amount in (estimate, maximum)):
    sys.exit("Indiquer l’estimation et le maximum accepté en CHF, avec un point décimal.")
if not 0 < Decimal(estimate) <= Decimal(maximum):
    sys.exit("L’estimation doit être positive et ne pas dépasser le maximum accepté.")
PY
fi

az_sub() { az "$@" --subscription "$subscription" --only-show-errors; }

state=$(az_sub account show --query state -o tsv)
[[ $state == Enabled ]] || fail 'L’abonnement indiqué n’est pas actif.'
for provider in Microsoft.ContainerService Microsoft.Compute Microsoft.Network; do
  state=$(az_sub provider show --namespace "$provider" --query registrationState -o tsv)
  [[ $state == Registered ]] || fail "$provider doit être enregistré sur l’abonnement (état : $state)."
done

skus=$(az_sub vm list-skus --location "$region" --resource-type virtualMachines --size "$sku" --all -o json)
quotas=$(az_sub vm list-usage --location "$region" -o json)
python3 - "$sku" "$skus" "$quotas" <<'PY' || exit 1
import json
import sys

sku_name, skus, quotas = sys.argv[1:]
sku = next((s for s in json.loads(skus) if s["name"].casefold() == sku_name.casefold()), None)
if not sku or sku.get("restrictions"):
    sys.exit("Le SKU est absent ou soumis à une restriction dans cette région pour l’abonnement.")
capabilities = {c["name"]: c["value"] for c in sku.get("capabilities", [])}
cpus = int(capabilities.get("vCPUs", 0))
if cpus < 4 or float(capabilities.get("MemoryGB", 0)) < 4 or sku_name.upper().startswith("STANDARD_B"):
    sys.exit("Le pool système demande un SKU hors série B avec au moins 4 vCPU et 4 Gio.")
usage = {q["name"]["value"].casefold(): q for q in json.loads(quotas)}
for key in ("cores", sku["family"].casefold()):
    quota = usage.get(key)
    if quota is None:
        sys.exit(f"Quota introuvable : {key}.")
    free = quota["limit"] - quota["currentValue"]
    print(f"{key} : {free} vCPU libres, {2 * cpus} requis.")
    if free < 2 * cpus:
        sys.exit("Quota insuffisant pour les deux nœuds système.")
PY
az_sub aks get-versions --location "$region" -o none

if [[ -n $image ]]; then
  python3 - "$image" <<'PY' || exit 1
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

repository, digest = sys.argv[1].removeprefix("ghcr.io/").split("@")
scope = urlencode({"scope": f"repository:{repository}:pull", "service": "ghcr.io"})
try:
    with urlopen(f"https://ghcr.io/token?{scope}", timeout=15) as response:
        token = json.load(response)["token"]
    request = Request(
        f"https://ghcr.io/v2/{repository}/manifests/{digest}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": ", ".join((
                "application/vnd.oci.image.index.v1+json",
                "application/vnd.oci.image.manifest.v1+json",
                "application/vnd.docker.distribution.manifest.list.v2+json",
                "application/vnd.docker.distribution.manifest.v2+json",
            )),
        },
    )
    with urlopen(request, timeout=15) as response:
        if response.headers.get("Docker-Content-Digest") != digest:
            sys.exit("Le registre ne confirme pas le digest demandé.")
except (HTTPError, URLError, KeyError):
    sys.exit("Impossible de vérifier l’accès public à l’image GHCR.")
print("Image GHCR et digest accessibles anonymement.")
PY
fi

printf 'Préflight terminé pour %s et %s. La capacité réelle dépend du déploiement.\n' "$region" "$sku"
[[ $mode == --apply ]] || exit 0

infra=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
demo=$(cd -- "$infra/.." && pwd)
run_id=$(python3 -c 'import uuid; print(uuid.uuid4().hex[:16])')
group="rg-pv-demo-$run_id"
node_group="$group-nodes"
cluster='aks-pv-demo-dev'
temp_dir=$(mktemp -d)
forward_pid=''
cleanup_armed=false

cleanup() {
  local status=$? exists owner target attempt
  trap - EXIT
  trap '' INT TERM
  if [[ -n $forward_pid ]]; then
    kill "$forward_pid" 2>/dev/null || true
    wait "$forward_pid" 2>/dev/null || true
  fi
  if [[ $cleanup_armed == true ]]; then
    if ! exists=$(az_sub group exists --name "$group" -o tsv); then
      printf 'État de %s à vérifier manuellement.\n' "$group" >&2
      status=1
    elif [[ $exists == true ]]; then
      owner=$(az_sub group show --name "$group" --query 'tags.pvDemoRun' -o tsv) || owner=''
      if [[ $owner == "$run_id" ]]; then
        az_sub group delete --name "$group" --yes -o none || status=1
      else
        printf 'Suppression refusée. Le tag de %s ne correspond pas à cet essai.\n' "$group" >&2
        status=1
      fi
    fi
    for target in "$group" "$node_group"; do
      if [[ $target == "$node_group" ]]; then
        for ((attempt=0; attempt<6; attempt++)); do
          exists=$(az_sub group exists --name "$target" -o tsv) || break
          [[ $exists == true ]] || break
          sleep 5
        done
      fi
      if exists=$(az_sub group exists --name "$target" -o tsv) && [[ $exists == false ]]; then
        printf 'Absence vérifiée : %s\n' "$target"
      else
        printf 'Nettoyage à vérifier manuellement dans Azure : %s\n' "$target" >&2
        status=1
      fi
    done
  fi
  rm -f -- "$temp_dir/id_rsa" "$temp_dir/id_rsa.pub" "$temp_dir/config" "$temp_dir/demo.yaml" "$temp_dir/forward.log"
  rmdir -- "$temp_dir" || true
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ $(az_sub group exists --name "$group" -o tsv) == false ]] || fail "Groupe déjà présent ou état inconnu : $group."
[[ $(az_sub group exists --name "$node_group" -o tsv) == false ]] || fail "Groupe de nœuds déjà présent ou état inconnu : $node_group."
ssh-keygen -q -t rsa -b 3072 -N '' -f "$temp_dir/id_rsa"
rm -f -- "$temp_dir/id_rsa"
grep -Fq 'image: pv-demo:local' "$demo/k8s/demo.yaml" || fail 'Image source inattendue dans le manifeste.'
grep -Fq 'imagePullPolicy: Never' "$demo/k8s/demo.yaml" || fail 'Politique source inattendue dans le manifeste.'
sed -e "s|image: pv-demo:local|image: $image|" \
    -e 's|imagePullPolicy: Never|imagePullPolicy: IfNotPresent|' "$demo/k8s/demo.yaml" > "$temp_dir/demo.yaml"

printf 'Création de %s (nœuds : %s), estimation %s CHF sur un maximum accepté de %s CHF.\n' \
  "$group" "$node_group" "$estimate" "$max_cost"
cleanup_armed=true
az_sub group create --name "$group" --location "$region" --tags "pvDemoRun=$run_id" -o none
deployment=(--resource-group "$group" --template-file "$infra/aks-dev.bicep" --parameters
  "clusterName=$cluster" "nodeVmSize=$sku" "adminIpv4=$admin_ip"
  'nodeAdminUsername=pvops' "sshPublicKey=$(cat "$temp_dir/id_rsa.pub")")
az_sub deployment group what-if "${deployment[@]}"
az_sub deployment group create "${deployment[@]}" -o none

umask 077
az_sub aks get-credentials --resource-group "$group" --name "$cluster" --admin --file "$temp_dir/config" -o none
kube() { kubectl --kubeconfig "$temp_dir/config" "$@"; }
kube wait --for=condition=Ready node --all --timeout=240s
[[ $(kube get nodes -o name | wc -l) -ge 2 ]] || fail 'Deux nœuds sont attendus.'
kube apply -f "$temp_dir/demo.yaml"
kube rollout status deployment/pv-demo --timeout=240s
kubectl --kubeconfig "$temp_dir/config" port-forward service/pv-demo :8000 --address 127.0.0.1 \
  > "$temp_dir/forward.log" 2>&1 &
forward_pid=$!
port=''
for ((attempt=0; attempt<30; attempt++)); do
  port=$(sed -n 's/^Forwarding from 127\.0\.0\.1:\([0-9][0-9]*\) -> 8000$/\1/p' "$temp_dir/forward.log")
  [[ -n $port ]] && break
  kill -0 "$forward_pid" 2>/dev/null || break
  sleep 1
done
[[ $port =~ ^[0-9]+$ ]] || fail 'La redirection locale du service n’a pas démarré.'
python3 "$demo/scripts/smoke.py" "http://127.0.0.1:$port"
printf 'Démonstrateur validé sur AKS en mode fixture. Nettoyage du groupe dédié.\n'
