# Portfolio technique de Bruno Giaconi

Le [portfolio](https://bruno-giaconi.github.io/) présente quatre applications personnelles, leur fonctionnement, leurs atouts et des captures réelles. Chaque fiche est disponible en français et en anglais. Le site est servi depuis `docs/`. Ce dépôt contient également l’API du relevé de décisions, son workflow, ses tests et son scénario reproductible.

## Découvrir les applications

- [Reno](https://bruno-giaconi.github.io/projets/reno.html), du plan 2D à la visite 3D, rendus IA, contraintes techniques et dossiers PDF de conception et d’évacuation.
- [P2PM](https://bruno-giaconi.github.io/projets/prince-2-pm.html), six étapes de pilotage inspirées de PRINCE2, registres reliés, gestion documentaire et huit formats de dossiers PDF. Neuf captures de l’application, anonymisées, retracent le parcours. Les approches Scrum, PMI et HERMES ainsi que l’adaptation à une IA locale sont présentées dans les évolutions en cours.
- [MyConf](https://bruno-giaconi.github.io/projets/myconf.html), traduction de conférence via ChatGPT Voice, écoute par QR et relais sans API de traduction supplémentaire. Validation complète en conditions de conférence à poursuivre.
- [Workflow IA](https://bruno-giaconi.github.io/projets/workflow-ia-azure.html), prototype technique personnel récent : décisions et actions reliées à leur source, revue humaine et déploiement de test vérifié sur Azure Container Instances.

Les captures et exports proviennent des applications. Les légendes précisent les variantes de conception, les données fictives et les rendus IA. Les anciennes démonstrations simplifiées ont été retirées ; leurs adresses renvoient vers les fiches des applications.

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

## Inférence facultative sur Azure OpenAI

Le mode `azure_openai` envoie la transcription fictive à l’API Responses v1 d’Azure OpenAI. Le modèle sélectionne des identifiants de passages au format JSON Schema strict. Le service assemble les citations et échéances à partir de la transcription locale, écarte les identifiants sans preuve et soumet le brouillon à validation humaine. [API Responses v1](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses) · [Sorties structurées](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs)

Prévoir une ressource Azure OpenAI ou Foundry, un déploiement de modèle OpenAI compatible avec Responses et les sorties structurées, et le rôle `Cognitive Services OpenAI User` pour l’identité de test sur cette ressource. La configuration utilise Microsoft Entra ID. [Authentification Entra](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/configure-entra-id)

Exemple PowerShell, après connexion à l’abonnement Azure autorisé avec `az login` :

```powershell
python -m pip install -r requirements-azure.txt
$env:PV_MODE = 'azure_openai'
$env:AZURE_OPENAI_ENDPOINT = 'https://<ressource>.openai.azure.com'
$env:AZURE_OPENAI_DEPLOYMENT = '<nom-du-deploiement>'
$env:AZURE_TOKEN_CREDENTIALS = 'AzureCliCredential'
python -m uvicorn pv_demo.api:app --host 127.0.0.1 --port 8000
```

`AZURE_OPENAI_ENDPOINT` accepte également l’hôte `<ressource>.services.ai.azure.com`. `AZURE_OPENAI_DEPLOYMENT` correspond au nom du déploiement dans la ressource, qui peut différer du nom du modèle. Depuis un second terminal, `python scripts/smoke.py http://127.0.0.1:8000 azure_openai` demande une vraie inférence et vérifie le parcours jusqu’à l’approbation. `/healthz` indique le mode actif. Une demande de brouillon est nécessaire pour vérifier la connexion et l’autorisation Azure.

Pour préparer l’image avec le SDK Microsoft, `docker build --build-arg REQUIREMENTS_FILE=requirements-azure.txt --tag pv-demo:azure .`. Une exécution sur AKS requiert une identité de charge de travail fédérée et le rôle d’inférence sur la ressource Azure OpenAI. Le manifeste `kind` conserve le mode `fixture`.

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

- Les tests locaux couvrent la fidélité des citations, les dates explicites ou absentes, l’approbation, le rejet et le refus d’une double validation. Le scénario HTTP complet en mode `fixture` a aussi été exécuté sur un serveur Uvicorn local.
- Le contrat Azure Responses, le démarrage avec le SDK et le traitement des réponses inattendues ont été vérifiés localement avec des réponses simulées.
- L’état est conservé en mémoire dans une seule instance. Cette version sert à l’essai local ou en cluster éphémère, sur données fictives.
- Le [pipeline de référence](https://github.com/bruno-giaconi/bruno-giaconi.github.io/actions/runs/42602636379) a passé les onze tests, construit l’image Docker, déployé le service sur Kubernetes avec kind et validé le parcours HTTP. L’image testée est disponible publiquement dans GHCR avec la référence ci-dessous.
- Le [modèle Bicep](infra/aks-dev.bicep) compile en ARM avec Bicep 0.48.1. Le [mode d’emploi Azure](infra/README.md) couvre le coût et la suppression du cluster de test.

```bash
docker pull ghcr.io/bruno-giaconi/releve-decisions@sha256:2a89a7c3381c92706363a5817363da12b89f78e954cf5674cc8ee827cdbd4237
```

## Essai Azure du 9 novembre 2026

- **Azure OpenAI**. Le service FastAPI exécuté dans Cloud Shell a appelé GPT‑4.1 mini via Microsoft Entra ID. La ressource Azure était en Suisse Nord et le type de déploiement Global Standard autorise un traitement hors de cette région. La transcription était entièrement fictive. Le test HTTP a confirmé trois sources exactes, une échéance absente laissée vide et une approbation séparée. Le groupe de ressources d’essai a été supprimé.
- **Azure Container Instances**. La même image GHCR, épinglée à son digest, a démarré en Suisse Nord sans IP publique. Son identité managée a reçu le rôle d’inférence à la portée de la seule ressource Azure OpenAI d’essai. L’API a exécuté le même parcours HTTP avec une inférence réelle et le conteneur s’est terminé avec le code 0.
- **Azure AKS**. Le contrôle de l’abonnement d’essai a relevé quatre vCPU disponibles en Suisse Nord, France Centre et Europe Ouest. Le modèle Bicep à deux nœuds exige huit vCPU. La validation Kubernetes du pipeline porte sur le cluster éphémère kind.

Le portfolio public reste une page GitHub Pages. L’API et le modèle sont destinés à une démonstration Azure à la demande, avec des données fictives. Le [guide AKS](infra/README.md) décrit le préflight et le test une fois les quotas disponibles.
