#!/usr/bin/env python3
"""
Script pour créer un fichier de données de référence (moyennes nationales, régionales, etc.)
pour permettre la comparaison des établissements.
"""

import json
from pathlib import Path
from statistics import mean, median, stdev, quantiles


def load_dataset(filepath):
    """Charge le dataset des établissements."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def calculate_stats(values):
    """Calcule les statistiques pour une liste de valeurs."""
    if not values:
        return None

    values = [v for v in values if v is not None]
    if not values:
        return None

    # Calculer les percentiles pour le classement
    sorted_values = sorted(values)
    n = len(sorted_values)

    def percentile(p):
        """Retourne la valeur au percentile p (0-100)."""
        if n == 0:
            return None
        k = (n - 1) * p / 100
        f = int(k)
        c = f + 1 if f + 1 < n else f
        return round(sorted_values[f] + (k - f) * (sorted_values[c] - sorted_values[f]), 2)

    return {
        'moyenne': round(mean(values), 2),
        'mediane': round(median(values), 2),
        'min': round(min(values), 2),
        'max': round(max(values), 2),
        'ecart_type': round(stdev(values), 2) if len(values) > 1 else 0,
        'effectif': len(values),
        'percentiles': {
            'top_1': percentile(99),     # Seuil pour être dans le top 1%
            'top_5': percentile(95),     # Seuil pour être dans le top 5%
            'top_10': percentile(90),    # Seuil pour être dans le top 10%
            'top_25': percentile(75),    # Seuil pour être dans le top 25%
            'top_50': percentile(50),    # Seuil pour être dans le top 50% (médiane)
            'bottom_50': percentile(50), # Seuil du bottom 50% (en dessous de la médiane)
            'bottom_25': percentile(25), # Seuil du bottom 25%
            'bottom_10': percentile(10), # Seuil du bottom 10%
            'bottom_5': percentile(5)    # Seuil du bottom 5%
        }
    }


def calculate_references(etablissements):
    """Calcule toutes les références statistiques."""

    # Séparer par type
    ecoles = [e for e in etablissements if e['type'] == 'ecole']
    colleges = [e for e in etablissements if e['type'] == 'college']
    lycees = [e for e in etablissements if e['type'] == 'lycee']

    references = {
        'national': {},
        'par_region': {},
        'par_departement': {}
    }

    # === RÉFÉRENCES NATIONALES ===

    # Écoles - IPS
    ips_all = [e['scores']['ips'] for e in ecoles if e['scores'].get('ips')]
    ips_public = [e['scores']['ips'] for e in ecoles if e['scores'].get('ips') and e['secteur'] == 'public']
    ips_prive = [e['scores']['ips'] for e in ecoles if e['scores'].get('ips') and e['secteur'] == 'prive']

    references['national']['ecoles'] = {
        'ips': {
            'tous': calculate_stats(ips_all),
            'public': calculate_stats(ips_public),
            'prive': calculate_stats(ips_prive)
        }
    }

    # Collèges - Score composite (réussite × note écrit) - pour classement uniquement
    score_colleges_all = [e['scores']['score_composite'] for e in colleges if e['scores'].get('score_composite')]
    score_colleges_public = [e['scores']['score_composite'] for e in colleges if e['scores'].get('score_composite') and e['secteur'] == 'public']
    score_colleges_prive = [e['scores']['score_composite'] for e in colleges if e['scores'].get('score_composite') and e['secteur'] == 'prive']

    # Calculer le taux de mentions pour les collèges
    def calcul_taux_mentions_college(college):
        mentions = college.get('mentions', {})
        nb_total = mentions.get('nb_mentions_total')
        nb_candidats = college['scores'].get('nb_candidats')
        if nb_total and nb_candidats and nb_candidats > 0:
            return (nb_total / nb_candidats) * 100
        return None

    taux_mentions_colleges = [calcul_taux_mentions_college(c) for c in colleges]
    taux_mentions_colleges = [t for t in taux_mentions_colleges if t is not None]

    references['national']['colleges'] = {
        'score_composite': {
            'tous': calculate_stats(score_colleges_all),
            'public': calculate_stats(score_colleges_public),
            'prive': calculate_stats(score_colleges_prive)
        },
        'taux_mentions': {
            'tous': calculate_stats(taux_mentions_colleges)
        }
    }

    # Lycées - Score composite (réussite toutes séries × mentions toutes séries)
    score_lycees_all = [e['scores']['score_composite'] for e in lycees if e['scores'].get('score_composite')]
    score_lycees_public = [e['scores']['score_composite'] for e in lycees if e['scores'].get('score_composite') and e['secteur'] == 'public']
    score_lycees_prive = [e['scores']['score_composite'] for e in lycees if e['scores'].get('score_composite') and e['secteur'] == 'prive']

    taux_mentions_lycees = [e['mentions']['taux_mentions'] for e in lycees if e.get('mentions', {}).get('taux_mentions')]

    references['national']['lycees'] = {
        'score_composite': {
            'tous': calculate_stats(score_lycees_all),
            'public': calculate_stats(score_lycees_public),
            'prive': calculate_stats(score_lycees_prive)
        },
        'taux_mentions': {
            'tous': calculate_stats(taux_mentions_lycees)
        }
    }

    # === RÉFÉRENCES PAR RÉGION ===

    regions = set(e['region'] for e in etablissements if e.get('region'))

    for region in regions:
        if not region:
            continue

        ecoles_region = [e for e in ecoles if e.get('region') == region]
        colleges_region = [e for e in colleges if e.get('region') == region]
        lycees_region = [e for e in lycees if e.get('region') == region]

        references['par_region'][region] = {
            'ecoles': {
                'ips': calculate_stats([e['scores']['ips'] for e in ecoles_region if e['scores'].get('ips')])
            },
            'colleges': {
                'score_composite': calculate_stats([e['scores']['score_composite'] for e in colleges_region if e['scores'].get('score_composite')])
            },
            'lycees': {
                'score_composite': calculate_stats([e['scores']['score_composite'] for e in lycees_region if e['scores'].get('score_composite')])
            }
        }

    # === RÉFÉRENCES PAR DÉPARTEMENT ===

    departements = set((e.get('code_departement'), e.get('departement')) for e in etablissements if e.get('departement'))

    for code_dept, nom_dept in departements:
        if not nom_dept:
            continue

        ecoles_dept = [e for e in ecoles if e.get('departement') == nom_dept]
        colleges_dept = [e for e in colleges if e.get('departement') == nom_dept]
        lycees_dept = [e for e in lycees if e.get('departement') == nom_dept]

        key = f"{code_dept}_{nom_dept}" if code_dept else nom_dept

        references['par_departement'][key] = {
            'code': code_dept,
            'nom': nom_dept,
            'ecoles': {
                'ips': calculate_stats([e['scores']['ips'] for e in ecoles_dept if e['scores'].get('ips')])
            },
            'colleges': {
                'score_composite': calculate_stats([e['scores']['score_composite'] for e in colleges_dept if e['scores'].get('score_composite')])
            },
            'lycees': {
                'score_composite': calculate_stats([e['scores']['score_composite'] for e in lycees_dept if e['scores'].get('score_composite')])
            }
        }

    return references


def main():
    base_path = Path(__file__).parent

    print("Chargement du dataset...")
    dataset = load_dataset(base_path / 'etablissements_france.json')
    etablissements = dataset['etablissements']
    print(f"  - {len(etablissements)} établissements chargés")

    print("\nCalcul des références...")
    references = calculate_references(etablissements)

    # Ajouter les métadonnées
    output = {
        'metadata': {
            'description': 'Données de référence pour la comparaison des établissements',
            'source': 'Calculé à partir de etablissements_france.json',
            'annee': '2024'
        },
        'references': references
    }

    # Sauvegarder
    output_path = base_path / 'references.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nFichier créé: {output_path}")

    # Afficher un résumé
    print("\n=== RÉSUMÉ DES MOYENNES NATIONALES ===")
    nat = references['national']

    print("\nÉcoles (IPS):")
    print(f"  - Tous: {nat['ecoles']['ips']['tous']['moyenne']} (médiane: {nat['ecoles']['ips']['tous']['mediane']})")
    print(f"  - Public: {nat['ecoles']['ips']['public']['moyenne']}")
    print(f"  - Privé: {nat['ecoles']['ips']['prive']['moyenne']}")

    print("\nCollèges (Score composite réussite × note écrit):")
    print(f"  - Tous: {nat['colleges']['score_composite']['tous']['moyenne']}")
    print(f"  - Public: {nat['colleges']['score_composite']['public']['moyenne']}")
    print(f"  - Privé: {nat['colleges']['score_composite']['prive']['moyenne']}")

    print("\nLycées (Score composite réussite × mentions toutes séries):")
    print(f"  - Tous: {nat['lycees']['score_composite']['tous']['moyenne']}")
    print(f"  - Public: {nat['lycees']['score_composite']['public']['moyenne']}")
    print(f"  - Privé: {nat['lycees']['score_composite']['prive']['moyenne']}")

    print(f"\nNombre de régions: {len(references['par_region'])}")
    print(f"Nombre de départements: {len(references['par_departement'])}")


if __name__ == '__main__':
    main()
