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
