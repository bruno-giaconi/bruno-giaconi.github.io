# Portfolio technique de Bruno Giaconi

Le [portfolio](https://bruno-giaconi.github.io/) présente quatre projets et leurs démonstrations. Le site est servi depuis `docs/`. Ce dépôt contient également l’API du relevé de décisions, son workflow, ses tests et son scénario reproductible.

## Relevé de décisions

Démonstrateur personnel d’un workflow de comptes rendus sur une réunion administrative fictive. Le mode `fixture` produit un résultat déterministe à partir de passages balisés.

1. Le workflow LangGraph extrait les décisions et actions en conservant le passage source.
2. Un contrôle compare chaque citation à sa source et laisse l’échéance à `null` si le passage ne fournit aucune date.
3. Le graphe suspend le traitement avec `interrupt`. Une décision humaine explicite reprend le graphe et approuve ou rejette le brouillon.

## Essai local

Avec Python 3.12, depuis ce dossier et dans un environnement virtuel activé :

```shell
python -m pip install -r requirements-test.txt
python -m unittest discover -s tests -v
python -m uvicorn pv_demo.api:app --host 127.0.0.1 --port 8000
```

Ouvrir [l’interface d’essai de l’API](http://127.0.0.1:8000/docs). Utiliser `GET /transcript`, puis `POST /drafts`. Reporter l’identifiant du brouillon dans `POST /drafts/{draft_id}/review` et fournir `{"approved": true}` ou `{"approved": false}`. Dans un second terminal, `python scripts/smoke.py` vérifie le même parcours sur HTTP.

`exemple-verifie.json` contient la transcription, un brouillon et l’état après approbation obtenus par l’API locale. L’identifiant aléatoire a été retiré.

## Livraison préparée

Le workflow GitHub Actions prévoit les tests, la construction de l’image, son chargement dans un cluster `kind` éphémère et un essai HTTP après déploiement. Pour reproduire ce parcours avec Docker, `kind` et `kubectl` :

```shell
docker build --tag pv-demo:local .
kind create cluster --name pv-demo --wait 90s
kind load docker-image --name pv-demo pv-demo:local
kubectl apply -f k8s/demo.yaml
kubectl rollout status deployment/pv-demo --timeout=90s
kubectl port-forward service/pv-demo 8000:8000
```

Lancer `python scripts/smoke.py` dans un second terminal. À la fin, arrêter la redirection de port et supprimer le cluster d’essai avec `kind delete cluster --name pv-demo`.

## Périmètre vérifié

- Six tests locaux passent sur FastAPI et LangGraph. Le scénario HTTP complet a aussi été exécuté sur un serveur Uvicorn temporaire sur la boucle locale. Ils couvrent la fidélité des citations, les dates explicites ou absentes, l’approbation, le rejet et le refus d’une double validation.
- L’état est conservé en mémoire dans une seule instance. Cette version sert à l’essai local ou en cluster éphémère, sur données fictives.
- Le [pipeline GitHub Actions vérifié](https://github.com/bruno-giaconi/bruno-giaconi.github.io/actions/runs/42600901287) a construit l’image Docker, déployé le service sur Kubernetes avec kind et vérifié le parcours HTTP. Il a aussi compilé le modèle Bicep en ARM. Une inférence réelle et un déploiement Azure restent des étapes séparées.

## Infrastructure Azure

Le [modèle Bicep pour un cluster AKS de test](infra/aks-dev.bicep) a été compilé en ARM. La [procédure de test](infra/README.md) documente le contrôle préalable, le coût des ressources et leur suppression. Le provisionnement Azure reste à valider.