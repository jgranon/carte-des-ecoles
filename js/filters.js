/**
 * Gestion des filtres
 */

const Filters = {
    currentFilters: {
        types: ['ecole', 'college', 'lycee'],
        secteurs: ['public', 'prive'],
        classement: 'tous',
        region: 'tous',
        departement: 'tous'
    },

    references: null,

    /**
     * Initialise les filtres
     */
    init(etablissements, references) {
        this.references = references;
        this.setupTypeFilters();
        this.setupSecteurFilters();
        this.setupClassementFilter();
        this.setupRegionFilter(etablissements);
        this.setupDepartementFilter(etablissements);
    },

    /**
     * Configure les filtres par type
     */
    setupTypeFilters() {
        const types = ['ecole', 'college', 'lycee'];
        types.forEach(type => {
            const checkbox = document.getElementById(`filter-${type}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.updateTypeFilter(type, checkbox.checked);
                });
            }
        });
    },

    /**
     * Met à jour le filtre de type
     */
    updateTypeFilter(type, checked) {
        if (checked) {
            if (!this.currentFilters.types.includes(type)) {
                this.currentFilters.types.push(type);
            }
        } else {
            this.currentFilters.types = this.currentFilters.types.filter(t => t !== type);
        }
        this.applyFilters();
    },

    /**
     * Configure les filtres par secteur
     */
    setupSecteurFilters() {
        const secteurs = ['public', 'prive'];
        secteurs.forEach(secteur => {
            const checkbox = document.getElementById(`filter-${secteur}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.updateSecteurFilter(secteur, checkbox.checked);
                });
            }
        });
    },

    /**
     * Met à jour le filtre de secteur
     */
    updateSecteurFilter(secteur, checked) {
        if (checked) {
            if (!this.currentFilters.secteurs.includes(secteur)) {
                this.currentFilters.secteurs.push(secteur);
            }
        } else {
            this.currentFilters.secteurs = this.currentFilters.secteurs.filter(s => s !== secteur);
        }
        this.applyFilters();
    },

    /**
     * Configure le filtre par classement
     */
    setupClassementFilter() {
        const select = document.getElementById('filter-classement');
        if (select) {
            select.addEventListener('change', () => {
                this.currentFilters.classement = select.value;
                this.applyFilters();
            });
        }
    },

    /**
     * Configure le filtre par région
     */
    setupRegionFilter(etablissements) {
        const select = document.getElementById('filter-region');
        if (!select) return;

        const regions = Utils.extractRegions(etablissements);
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            this.currentFilters.region = select.value;
            this.currentFilters.departement = 'tous';
            this.updateDepartementOptions(etablissements);
            this.applyFilters();
        });
    },

    /**
     * Configure le filtre par département
     */
    setupDepartementFilter(etablissements) {
        const select = document.getElementById('filter-departement');
        if (!select) return;

        this.updateDepartementOptions(etablissements);

        select.addEventListener('change', () => {
            this.currentFilters.departement = select.value;
            this.applyFilters();
        });
    },

    /**
     * Met à jour les options de département selon la région
     */
    updateDepartementOptions(etablissements) {
        const select = document.getElementById('filter-departement');
        if (!select) return;

        // Vider les options existantes
        select.innerHTML = '<option value="tous">Tous les départements</option>';

        // Filtrer par région si nécessaire
        const region = this.currentFilters.region !== 'tous' ? this.currentFilters.region : null;
        const departements = Utils.extractDepartements(etablissements, region);

        departements.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.nom;
            option.textContent = `${dept.code} - ${dept.nom}`;
            select.appendChild(option);
        });

        // Réinitialiser la sélection
        select.value = 'tous';
    },

    /**
     * Applique les filtres et met à jour la carte
     */
    applyFilters() {
        const allMarkers = MapManager.getAllMarkers();

        const filteredMarkers = allMarkers.filter(marker => {
            // Un marqueur peut contenir plusieurs établissements
            const etablissements = marker.etablissements || [marker.etablissement];

            // Le marqueur est affiché si au moins un établissement du groupe passe les filtres
            return etablissements.some(etab => {
                const classement = Utils.classify(etab, this.references);

                // Filtre par type
                if (!this.currentFilters.types.includes(etab.type)) {
                    return false;
                }

                // Filtre par secteur
                if (!this.currentFilters.secteurs.includes(etab.secteur)) {
                    return false;
                }

                // Filtre par classement
                if (!Utils.matchesClassementFilter(classement, this.currentFilters.classement)) {
                    return false;
                }

                // Filtre par région
                if (this.currentFilters.region !== 'tous' && etab.region !== this.currentFilters.region) {
                    return false;
                }

                // Filtre par département
                if (this.currentFilters.departement !== 'tous' && etab.departement !== this.currentFilters.departement) {
                    return false;
                }

                return true;
            });
        });

        MapManager.updateMarkers(filteredMarkers);
        this.updateStats(filteredMarkers);
    },

    /**
     * Met à jour les statistiques affichées
     */
    updateStats(markers) {
        const countEl = document.getElementById('stats-count');
        const moyenneEl = document.getElementById('stats-moyenne');

        // Compter tous les établissements (pas juste les marqueurs)
        let totalEtablissements = 0;
        const scores = [];

        markers.forEach(m => {
            const etablissements = m.etablissements || [m.etablissement];
            etablissements.forEach(etab => {
                // Vérifier si cet établissement passe les filtres actuels
                const classement = Utils.classify(etab, this.references);
                if (this.currentFilters.types.includes(etab.type) &&
                    this.currentFilters.secteurs.includes(etab.secteur) &&
                    Utils.matchesClassementFilter(classement, this.currentFilters.classement) &&
                    (this.currentFilters.region === 'tous' || etab.region === this.currentFilters.region) &&
                    (this.currentFilters.departement === 'tous' || etab.departement === this.currentFilters.departement)) {
                    totalEtablissements++;
                    const score = Utils.getScore(etab);
                    if (score !== null && score !== undefined) {
                        scores.push(score);
                    }
                }
            });
        });

        if (countEl) {
            countEl.textContent = totalEtablissements.toLocaleString('fr-FR');
        }

        if (moyenneEl) {
            if (scores.length === 0) {
                moyenneEl.textContent = '-';
            } else {
                const moyenne = scores.reduce((a, b) => a + b, 0) / scores.length;
                moyenneEl.textContent = Utils.formatNumber(moyenne);
            }
        }
    }
};
