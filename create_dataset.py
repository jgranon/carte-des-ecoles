#!/usr/bin/env python3
"""
Script pour créer un jeu de données unifié des établissements scolaires français.
Fusionne les données d'écoles (IPS), collèges (brevet) et lycées (bac).
"""

import csv
import json
from pathlib import Path


def load_csv(filepath, delimiter=';'):
    """Charge un fichier CSV et retourne une liste de dictionnaires."""
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        return list(reader)


def parse_float(value):
    """Convertit une valeur en float, retourne None si impossible."""
    if value is None or value == '' or value == 'NS' or value == 'ND':
        return None
    try:
        return float(value.replace(',', '.'))
    except (ValueError, AttributeError):
        return None


def parse_int(value):
    """Convertit une valeur en int, retourne None si impossible."""
    if value is None or value == '' or value == 'NS' or value == 'ND':
        return None
    try:
        return int(float(value))
    except (ValueError, AttributeError):
        return None


def process_ecoles(data):
    """Traite les données des écoles (score IPS)."""
    etablissements = []

    # Trouver l'année la plus récente
    annees = set(row.get('Rentrée scolaire', '') for row in data if row.get('Rentrée scolaire'))
    annee_recente = max(annees) if annees else None
    print(f"    Écoles: année retenue = {annee_recente}")

    for row in data:
        # Ne garder que l'année la plus récente
        if row.get('Rentrée scolaire') != annee_recente:
            continue

        ips = parse_float(row.get('IPS'))
        if ips is None:
            continue

        etablissement = {
            'uai': row.get('UAI', '').strip(),
            'nom': row.get("Nom de l'établissement", '').strip(),
            'type': 'ecole',
            'secteur': 'public' if 'public' in row.get('Secteur', '').lower() else 'prive',
            'code_region': row.get('Code région', '').strip(),
            'region': row.get('Région', '').strip(),
            'code_departement': row.get('Code du département', '').strip(),
            'departement': row.get('Département', '').strip(),
            'code_insee': row.get('Code INSEE de la commune', '').strip(),
            'commune': row.get('Nom de la commune', '').strip(),
            'annee': row.get('Rentrée scolaire', '').strip(),
            'scores': {
                'ips': ips,
                'ips_national': parse_float(row.get('IPS national')),
                'ips_academique': parse_float(row.get('IPS académique')),
                'ips_departemental': parse_float(row.get('IPS départemental'))
            }
        }
        etablissements.append(etablissement)

    return etablissements


def process_colleges(data):
    """Traite les données des collèges (brevet)."""
    etablissements = []

    # Trouver la session la plus récente
    sessions = set(parse_int(row.get('Session')) for row in data if row.get('Session'))
    sessions = {s for s in sessions if s is not None}
    session_recente = max(sessions) if sessions else None
    print(f"    Collèges: session retenue = {session_recente}")

    # Garder uniquement la session la plus récente
    for row in data:
        session = parse_int(row.get('Session'))
        if session != session_recente:
            continue

        uai = row.get('UAI', '').strip()
        taux_reussite = parse_float(row.get('Taux de réussite G'))
        if taux_reussite is None:
            continue

        secteur_raw = row.get('Secteur', '').strip()
        secteur = 'public' if secteur_raw == 'PU' else 'prive'

        nb_mentions_ab = parse_int(row.get('Nb mentions AB G'))
        nb_mentions_b = parse_int(row.get('Nb mentions B G'))
        nb_mentions_tb = parse_int(row.get('Nb mentions TB G'))
        nb_candidats = parse_int(row.get('Nb candidats G'))

        # Calculer le taux de mentions TB et le score composite
        taux_mentions_tb = None
        score_composite = None
        if nb_candidats and nb_candidats > 0 and nb_mentions_tb is not None:
            taux_mentions_tb = round((nb_mentions_tb / nb_candidats) * 100, 2)
            # Score = taux de réussite × taux de mentions TB
            score_composite = round((taux_reussite * taux_mentions_tb) / 100, 2)

        etablissement = {
            'uai': uai,
            'nom': row.get("Nom de l'établissement", '').strip(),
            'type': 'college',
            'secteur': secteur,
            'code_region': row.get('Code région académique', '').strip(),
            'region': row.get('Région académique', '').strip(),
            'code_departement': row.get('Code département', '').strip(),
            'departement': row.get('Département', '').strip(),
            'code_insee': '',  # Non disponible dans ce fichier
            'commune': row.get('Commune', '').strip(),
            'annee': str(session_recente),
            'scores': {
                'taux_reussite_brevet': taux_reussite,
                'taux_mentions_tb': taux_mentions_tb,
                'score_composite': score_composite,
                'nb_candidats': nb_candidats,
                'note_ecrit': parse_float(row.get('Note à l\'écrit G'))
            },
            'mentions': {
                'nb_mentions_ab': nb_mentions_ab,
                'nb_mentions_b': nb_mentions_b,
                'nb_mentions_tb': nb_mentions_tb,
                'nb_mentions_total': parse_int(row.get('Nb mentions global G'))
            }
        }
        etablissements.append(etablissement)

    return etablissements


def process_lycees(data):
    """Traite les données des lycées (bac)."""
    etablissements = []

    # Trouver l'année la plus récente
    annees = set(parse_int(row.get('Année')) for row in data if row.get('Année'))
    annees = {a for a in annees if a is not None}
    annee_recente = max(annees) if annees else None
    print(f"    Lycées: année retenue = {annee_recente}")

    # Garder uniquement l'année la plus récente
    for row in data:
        annee = parse_int(row.get('Année'))
        if annee != annee_recente:
            continue

        uai = row.get('UAI', '').strip()
        # Utiliser uniquement les données du bac général
        taux_reussite = parse_float(row.get('Taux de réussite - Gnle'))
        if taux_reussite is None:
            continue

        secteur_raw = row.get('Secteur', '').strip().lower()
        secteur = 'public' if 'public' in secteur_raw else 'prive'

        # Mentions détaillées pour le bac général
        nb_presents = parse_int(row.get('Présents - Gnle'))
        nb_tb_fel = parse_int(row.get('Nombre de mentions TB avec félicitations - G'))
        nb_tb = parse_int(row.get('Nombre de mentions TB sans félicitations - G'))
        nb_b = parse_int(row.get('Nombre de mentions B - G'))
        nb_ab = parse_int(row.get('Nombre de mentions AB - G'))

        # Calculer le taux de mentions TB et le score composite
        taux_mentions_tb = None
        score_composite = None
        nb_mentions_tb_total = (nb_tb_fel or 0) + (nb_tb or 0)
        if nb_presents and nb_presents > 0 and nb_mentions_tb_total > 0:
            taux_mentions_tb = round((nb_mentions_tb_total / nb_presents) * 100, 2)
            # Score = taux de réussite × taux de mentions TB
            score_composite = round((taux_reussite * taux_mentions_tb) / 100, 2)

        etablissement = {
            'uai': uai,
            'nom': row.get('Etablissement', '').strip(),
            'type': 'lycee',
            'secteur': secteur,
            'code_region': row.get('Code région', '').strip(),
            'region': row.get('Region', '').strip(),
            'code_departement': row.get('Code departement', '').strip(),
            'departement': row.get('Département', '').strip(),
            'code_insee': row.get('Code commune', '').strip(),
            'commune': row.get('Commune', '').strip(),
            'annee': str(annee_recente),
            'scores': {
                'taux_reussite_bac': taux_reussite,
                'taux_mentions_tb': taux_mentions_tb,
                'score_composite': score_composite,
                'taux_acces_2nde_bac': parse_float(row.get('Taux d\'accès 2nde-bac')),
                'nb_presents': nb_presents
            },
            'mentions': {
                'taux_mentions': parse_float(row.get('Taux de mentions - Gnle')),
                'nb_mentions_tb_fel': nb_tb_fel,
                'nb_mentions_tb': nb_tb,
                'nb_mentions_b': nb_b,
                'nb_mentions_ab': nb_ab
            }
        }
        etablissements.append(etablissement)

    return etablissements


def load_coordinates(filepath):
    """Charge les coordonnées GPS depuis l'annuaire de l'éducation."""
    coords = {}
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            uai = row.get('Identifiant_de_l_etablissement', '').strip()
            lat = parse_float(row.get('latitude'))
            lon = parse_float(row.get('longitude'))
            if uai and lat is not None and lon is not None:
                coords[uai] = {'latitude': lat, 'longitude': lon}
    return coords


def main():
    base_path = Path(__file__).parent

    print("Chargement des fichiers...")

    # Charger les données
    ecoles_data = load_csv(base_path / 'fr-en-ips-ecoles-ap2022.csv')
    colleges_data = load_csv(base_path / 'fr-en-indicateurs-valeur-ajoutee-colleges.csv')
    lycees_data = load_csv(base_path / 'fr-en-indicateurs-de-resultat-des-lycees-gt_v2.csv')

    print(f"  - Écoles: {len(ecoles_data)} lignes")
    print(f"  - Collèges: {len(colleges_data)} lignes")
    print(f"  - Lycées: {len(lycees_data)} lignes")

    print("\nTraitement des données...")

    # Traiter chaque type d'établissement
    ecoles = process_ecoles(ecoles_data)
    colleges = process_colleges(colleges_data)
    lycees = process_lycees(lycees_data)

    print(f"  - Écoles traitées: {len(ecoles)}")
    print(f"  - Collèges traités: {len(colleges)}")
    print(f"  - Lycées traités: {len(lycees)}")

    # Charger les coordonnées GPS
    print("\nChargement des coordonnées GPS...")
    annuaire_path = base_path / 'annuaire_education.csv'
    if annuaire_path.exists():
        coordinates = load_coordinates(annuaire_path)
        print(f"  - Coordonnées chargées: {len(coordinates)} établissements")
    else:
        coordinates = {}
        print("  - Fichier annuaire non trouvé, coordonnées non disponibles")

    # Fusionner toutes les données
    all_etablissements = ecoles + colleges + lycees

    # Ajouter les coordonnées GPS à chaque établissement
    with_coords = 0
    for etab in all_etablissements:
        uai = etab.get('uai', '')
        if uai in coordinates:
            etab['latitude'] = coordinates[uai]['latitude']
            etab['longitude'] = coordinates[uai]['longitude']
            with_coords += 1
        else:
            etab['latitude'] = None
            etab['longitude'] = None

    print(f"  - Établissements avec coordonnées: {with_coords}/{len(all_etablissements)} ({100*with_coords//len(all_etablissements)}%)")

    # Calculer le rang pour chaque type d'établissement
    print("\nCalcul des classements...")

    # Écoles : rang basé sur IPS
    ecoles_with_score = [(e, e['scores']['ips']) for e in ecoles if e['scores'].get('ips') is not None]
    ecoles_with_score.sort(key=lambda x: x[1], reverse=True)  # Tri décroissant
    for rank, (etab, _) in enumerate(ecoles_with_score, 1):
        etab['rang'] = rank
        etab['total_type'] = len(ecoles_with_score)
    print(f"  - Écoles classées: {len(ecoles_with_score)}")

    # Collèges : rang basé sur score_composite (réussite × mentions TB)
    colleges_with_score = [(e, e['scores']['score_composite']) for e in colleges if e['scores'].get('score_composite') is not None]
    colleges_with_score.sort(key=lambda x: x[1], reverse=True)
    for rank, (etab, _) in enumerate(colleges_with_score, 1):
        etab['rang'] = rank
        etab['total_type'] = len(colleges_with_score)
    print(f"  - Collèges classés: {len(colleges_with_score)}")

    # Lycées : rang basé sur score_composite (réussite × mentions TB)
    lycees_with_score = [(e, e['scores']['score_composite']) for e in lycees if e['scores'].get('score_composite') is not None]
    lycees_with_score.sort(key=lambda x: x[1], reverse=True)
    for rank, (etab, _) in enumerate(lycees_with_score, 1):
        etab['rang'] = rank
        etab['total_type'] = len(lycees_with_score)
    print(f"  - Lycées classés: {len(lycees_with_score)}")

    # Créer le dataset final
    dataset = {
        'metadata': {
            'description': 'Données des établissements scolaires français',
            'sources': [
                'fr-en-ips-ecoles-ap2022.csv (IPS des écoles)',
                'fr-en-indicateurs-valeur-ajoutee-colleges.csv (Résultats brevet)',
                'fr-en-indicateurs-de-resultat-des-lycees-gt_v2.csv (Résultats bac)',
                'annuaire_education.csv (Coordonnées GPS)'
            ],
            'total_etablissements': len(all_etablissements),
            'etablissements_avec_coordonnees': with_coords,
            'par_type': {
                'ecoles': len(ecoles),
                'colleges': len(colleges),
                'lycees': len(lycees)
            }
        },
        'etablissements': all_etablissements
    }

    # Sauvegarder en JSON
    output_path = base_path / 'etablissements_france.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    print(f"\nFichier créé: {output_path}")
    print(f"Total: {len(all_etablissements)} établissements")


if __name__ == '__main__':
    main()
