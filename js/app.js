/**
 * Point d'entrée de l'application Carte des Écoles
 */

const App = {
    etablissements: [],
    references: null,

    /**
     * Initialise l'application
     */
    async init() {
        try {
            // Afficher le loading
            this.showLoading(true);

            // Initialiser la carte
            MapManager.init();

            // Charger les données
            await this.loadData();

            // Initialiser les filtres
            Filters.init(this.etablissements, this.references);

            // Initialiser la recherche
            Search.init(this.etablissements);

            // Initialiser le mobile
            this.initMobile();

            // Ajouter les établissements à la carte
            MapManager.addEtablissements(this.etablissements, this.references);

            // Appliquer les filtres initiaux
            Filters.applyFilters();

            // Cacher le loading
            this.showLoading(false);

            console.log(`Application initialisée avec ${this.etablissements.length} établissements`);

        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    /**
     * Charge les données JSON
     */
    async loadData() {
        // Charger les établissements
        const etablissementsResponse = await fetch('etablissements_france.json');
        if (!etablissementsResponse.ok) {
            throw new Error('Impossible de charger etablissements_france.json');
        }
        const etablissementsData = await etablissementsResponse.json();
        this.etablissements = etablissementsData.etablissements;

        // Charger les références
        const referencesResponse = await fetch('references.json');
        if (!referencesResponse.ok) {
            throw new Error('Impossible de charger references.json');
        }
        const referencesData = await referencesResponse.json();
        this.references = referencesData.references;
    },

    /**
     * Affiche ou cache le loading
     */
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.toggle('hidden', !show);
        }
    },

    /**
     * Initialise les fonctionnalités mobile
     */
    initMobile() {
        // Modal recherche
        const searchBtn = document.getElementById('mobile-search-btn');
        const searchModal = document.getElementById('mobile-search-modal');
        const searchInput = document.getElementById('mobile-search-input');
        const searchResults = document.getElementById('mobile-search-results');
        const searchBack = searchModal?.querySelector('.mobile-modal-back');

        // Modal filtres
        const filtersBtn = document.getElementById('mobile-filters-btn');
        const filtersModal = document.getElementById('mobile-filters-modal');
        const filtersBack = filtersModal?.querySelector('.mobile-modal-back');
        const filtersApply = document.getElementById('mobile-filters-apply');
        const filtersReset = document.getElementById('mobile-filters-reset');

        // Ouvrir modal recherche
        if (searchBtn && searchModal) {
            searchBtn.addEventListener('click', () => {
                searchModal.classList.add('open');
                setTimeout(() => searchInput?.focus(), 100);
            });
        }

        // Fermer modal recherche
        if (searchBack) {
            searchBack.addEventListener('click', () => {
                searchModal.classList.remove('open');
            });
        }

        // Recherche mobile
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim().toLowerCase();
                this.updateMobileSearchResults(query, searchResults);
            });
        }

        // Ouvrir modal filtres
        if (filtersBtn && filtersModal) {
            filtersBtn.addEventListener('click', () => {
                this.syncFiltersToMobile();
                filtersModal.classList.add('open');
            });
        }

        // Fermer modal filtres
        if (filtersBack) {
            filtersBack.addEventListener('click', () => {
                filtersModal.classList.remove('open');
            });
        }

        // Appliquer les filtres
        if (filtersApply) {
            filtersApply.addEventListener('click', () => {
                this.applyMobileFilters();
                filtersModal.classList.remove('open');
            });
        }

        // Réinitialiser les filtres
        if (filtersReset) {
            filtersReset.addEventListener('click', () => {
                this.resetMobileFilters();
            });
        }

        // Accordéon des sections de filtres
        const filterHeaders = document.querySelectorAll('.mobile-filter-header');
        filterHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const section = header.parentElement;
                section.classList.toggle('open');
            });
        });

        // Peupler les selects région/département
        this.populateMobileSelects();
    },

    /**
     * Met à jour les résultats de recherche mobile
     */
    updateMobileSearchResults(query, container) {
        if (!container) return;

        if (query.length < 2) {
            container.innerHTML = '<div class="mobile-search-empty">Tapez au moins 2 caractères</div>';
            return;
        }

        const results = this.etablissements
            .filter(e => e.nom.toLowerCase().includes(query) ||
                        e.commune?.toLowerCase().includes(query))
            .slice(0, 20);

        if (results.length === 0) {
            container.innerHTML = '<div class="mobile-search-empty">Aucun résultat</div>';
            return;
        }

        const typeLabels = { ecole: 'École', college: 'Collège', lycee: 'Lycée' };

        container.innerHTML = results.map(e => `
            <div class="mobile-search-result" data-uai="${e.uai}">
                <div class="mobile-search-result-name">${e.nom}</div>
                <div class="mobile-search-result-info">
                    <span class="mobile-search-result-type ${e.type}">${typeLabels[e.type]}</span>
                    ${e.commune}, ${e.departement}
                </div>
            </div>
        `).join('');

        // Ajouter les événements de clic
        container.querySelectorAll('.mobile-search-result').forEach(item => {
            item.addEventListener('click', () => {
                const uai = item.dataset.uai;
                const etab = this.etablissements.find(e => e.uai === uai);
                if (etab) {
                    document.getElementById('mobile-search-modal').classList.remove('open');

                    if (etab.lat && etab.lon) {
                        MapManager.map.setView([etab.lat, etab.lon], 15);
                    }

                    // Ouvrir la modal mobile avec la fiche
                    MapManager.openMobileModal([etab], this.references);
                }
            });
        });
    },

    /**
     * Peuple les selects région/département mobile
     */
    populateMobileSelects() {
        const regionSelect = document.getElementById('mobile-filter-region');
        const deptSelect = document.getElementById('mobile-filter-departement');
        const desktopRegion = document.getElementById('filter-region');
        const desktopDept = document.getElementById('filter-departement');

        if (regionSelect && desktopRegion) {
            regionSelect.innerHTML = desktopRegion.innerHTML;
        }
        if (deptSelect && desktopDept) {
            deptSelect.innerHTML = desktopDept.innerHTML;
        }
    },

    /**
     * Synchronise les filtres desktop vers mobile
     */
    syncFiltersToMobile() {
        // Checkboxes
        ['filter-ecole', 'filter-college', 'filter-lycee', 'filter-public', 'filter-prive'].forEach(id => {
            const desktop = document.getElementById(id);
            const mobile = document.querySelector(`[data-filter="${id}"]`);
            if (desktop && mobile) {
                mobile.checked = desktop.checked;
            }
        });

        // Selects
        ['classement', 'region', 'departement'].forEach(name => {
            const desktop = document.getElementById(`filter-${name}`);
            const mobile = document.getElementById(`mobile-filter-${name}`);
            if (desktop && mobile) {
                mobile.value = desktop.value;
            }
        });
    },

    /**
     * Applique les filtres mobile vers desktop
     */
    applyMobileFilters() {
        // Mettre à jour les types
        const types = [];
        if (document.querySelector('[data-filter="filter-ecole"]')?.checked) types.push('ecole');
        if (document.querySelector('[data-filter="filter-college"]')?.checked) types.push('college');
        if (document.querySelector('[data-filter="filter-lycee"]')?.checked) types.push('lycee');
        Filters.currentFilters.types = types;

        // Mettre à jour les secteurs
        const secteurs = [];
        if (document.querySelector('[data-filter="filter-public"]')?.checked) secteurs.push('public');
        if (document.querySelector('[data-filter="filter-prive"]')?.checked) secteurs.push('prive');
        Filters.currentFilters.secteurs = secteurs;

        // Mettre à jour les selects
        const classement = document.getElementById('mobile-filter-classement')?.value || 'tous';
        const region = document.getElementById('mobile-filter-region')?.value || 'tous';
        const departement = document.getElementById('mobile-filter-departement')?.value || 'tous';

        Filters.currentFilters.classement = classement;
        Filters.currentFilters.region = region;
        Filters.currentFilters.departement = departement;

        // Synchroniser avec les contrôles desktop
        document.getElementById('filter-ecole').checked = types.includes('ecole');
        document.getElementById('filter-college').checked = types.includes('college');
        document.getElementById('filter-lycee').checked = types.includes('lycee');
        document.getElementById('filter-public').checked = secteurs.includes('public');
        document.getElementById('filter-prive').checked = secteurs.includes('prive');
        document.getElementById('filter-classement').value = classement;
        document.getElementById('filter-region').value = region;
        document.getElementById('filter-departement').value = departement;

        // Appliquer les filtres
        Filters.applyFilters();
    },

    /**
     * Réinitialise les filtres mobile
     */
    resetMobileFilters() {
        // Checkboxes à true
        document.querySelectorAll('.mobile-checkbox input').forEach(cb => cb.checked = true);
        // Selects à "tous"
        document.querySelectorAll('.mobile-select').forEach(sel => sel.value = 'tous');
    },

    /**
     * Affiche une erreur
     */
    showError(message) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div style="color: #d32f2f; text-align: center;">
                    <p style="font-size: 1.2rem; margin-bottom: 10px;">Erreur</p>
                    <p>${message}</p>
                    <p style="margin-top: 15px; font-size: 0.9rem;">
                        Vérifiez que les fichiers JSON sont présents dans le même répertoire.
                    </p>
                </div>
            `;
        }
    }
};

// Lancer l'application quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
