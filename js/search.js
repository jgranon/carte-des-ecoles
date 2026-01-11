/**
 * Gestion de la recherche
 */

const Search = {
    etablissements: [],
    searchInput: null,
    resultsContainer: null,

    /**
     * Initialise la recherche
     */
    init(etablissements) {
        this.etablissements = etablissements;
        this.searchInput = document.getElementById('search');
        this.resultsContainer = document.getElementById('search-results');

        if (!this.searchInput || !this.resultsContainer) return;

        // Événement de saisie avec debounce
        this.searchInput.addEventListener('input', Utils.debounce(() => {
            this.performSearch(this.searchInput.value);
        }, 300));

        // Fermer les résultats quand on clique ailleurs
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.resultsContainer.contains(e.target)) {
                this.hideResults();
            }
        });

        // Focus sur l'input
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.length >= 2) {
                this.performSearch(this.searchInput.value);
            }
        });

        // Navigation au clavier
        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });
    },

    /**
     * Effectue la recherche
     */
    performSearch(query) {
        if (query.length < 2) {
            this.hideResults();
            return;
        }

        const normalizedQuery = this.normalizeString(query);

        // Rechercher dans les établissements
        const results = this.etablissements
            .filter(etab => {
                const normalizedName = this.normalizeString(etab.nom);
                const normalizedCommune = this.normalizeString(etab.commune);
                return normalizedName.includes(normalizedQuery) ||
                       normalizedCommune.includes(normalizedQuery);
            })
            .slice(0, 20); // Limiter à 20 résultats

        this.showResults(results);
    },

    /**
     * Normalise une chaîne pour la recherche
     */
    normalizeString(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    },

    /**
     * Affiche les résultats
     */
    showResults(results) {
        if (results.length === 0) {
            this.resultsContainer.innerHTML = '<div class="search-result-item">Aucun résultat</div>';
        } else {
            this.resultsContainer.innerHTML = results.map((etab, index) => `
                <div class="search-result-item" data-index="${index}">
                    <div class="search-result-name">${this.highlightMatch(etab.nom, this.searchInput.value)}</div>
                    <div class="search-result-info">
                        ${this.getTypeLabel(etab.type)} - ${etab.commune}, ${etab.departement}
                    </div>
                </div>
            `).join('');

            // Ajouter les événements de clic
            this.resultsContainer.querySelectorAll('.search-result-item[data-index]').forEach((item, index) => {
                item.addEventListener('click', () => {
                    this.selectResult(results[index]);
                });
            });
        }

        this.resultsContainer.classList.add('active');
    },

    /**
     * Cache les résultats
     */
    hideResults() {
        this.resultsContainer.classList.remove('active');
    },

    /**
     * Met en surbrillance la correspondance
     */
    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    },

    /**
     * Échappe les caractères spéciaux regex
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Obtient le libellé du type
     */
    getTypeLabel(type) {
        const labels = {
            'ecole': 'École',
            'college': 'Collège',
            'lycee': 'Lycée'
        };
        return labels[type] || type;
    },

    /**
     * Sélectionne un résultat
     */
    selectResult(etab) {
        this.searchInput.value = etab.nom;
        this.hideResults();
        MapManager.zoomToEtablissement(etab);
    },

    /**
     * Gère la navigation au clavier
     */
    handleKeyboard(e) {
        const items = this.resultsContainer.querySelectorAll('.search-result-item[data-index]');
        if (items.length === 0) return;

        const currentActive = this.resultsContainer.querySelector('.search-result-item.active');
        let currentIndex = currentActive ? parseInt(currentActive.dataset.index) : -1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, items.length - 1);
                this.highlightItem(items, currentIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                this.highlightItem(items, currentIndex);
                break;
            case 'Enter':
                e.preventDefault();
                if (currentActive) {
                    currentActive.click();
                }
                break;
            case 'Escape':
                this.hideResults();
                this.searchInput.blur();
                break;
        }
    },

    /**
     * Met en surbrillance un élément de la liste
     */
    highlightItem(items, index) {
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
        if (items[index]) {
            items[index].scrollIntoView({ block: 'nearest' });
        }
    }
};
