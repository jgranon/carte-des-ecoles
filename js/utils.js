/**
 * Fonctions utilitaires pour l'application Carte des Écoles
 */

const Utils = {
    /**
     * Obtient le score principal d'un établissement selon son type
     * Pour collèges/lycées : score_composite (réussite × mentions TB)
     */
    getScore(etablissement) {
        if (etablissement.type === 'ecole') {
            return etablissement.scores?.ips;
        } else if (etablissement.type === 'college') {
            return etablissement.scores?.score_composite;
        } else if (etablissement.type === 'lycee') {
            return etablissement.scores?.score_composite;
        }
        return null;
    },

    /**
     * Obtient le libellé du score selon le type
     */
    getScoreLabel(type) {
        switch (type) {
            case 'ecole': return 'IPS';
            case 'college': return 'Score composite';
            case 'lycee': return 'Score composite';
            default: return 'Score';
        }
    },

    /**
     * Obtient l'unité du score selon le type
     */
    getScoreUnit(type) {
        return '';  // Le score composite n'a pas d'unité %
    },

    /**
     * Classifie un établissement selon les percentiles de référence
     */
    classify(etablissement, references) {
        const score = this.getScore(etablissement);
        if (score === null || score === undefined) return null;

        const type = etablissement.type + 's'; // ecoles, colleges, lycees
        const refType = references?.national?.[type];
        if (!refType) return null;

        let percentiles;
        if (type === 'ecoles') {
            percentiles = refType.ips?.tous?.percentiles;
        } else {
            // Collèges et lycées utilisent score_composite
            percentiles = refType.score_composite?.tous?.percentiles;
        }

        if (!percentiles) return null;

        if (score >= percentiles.top_1) return 'top_1';
        if (score >= percentiles.top_5) return 'top_5';
        if (score >= percentiles.top_10) return 'top_10';
        if (score >= percentiles.top_25) return 'top_25';
        if (score >= percentiles.top_50) return 'top_50';
        if (score <= percentiles.bottom_10) return 'bottom_10';
        if (score <= percentiles.bottom_25) return 'bottom_25';
        return 'bottom_50';
    },

    /**
     * Obtient le libellé du classement
     */
    getClassementLabel(classement) {
        const labels = {
            'top_1': 'Top 1%',
            'top_5': 'Top 5%',
            'top_10': 'Top 10%',
            'top_25': 'Top 25%',
            'top_50': 'Top 50%',
            'bottom_50': 'Bottom 50%',
            'bottom_25': 'Bottom 25%',
            'bottom_10': 'Bottom 10%'
        };
        return labels[classement] || 'Non classé';
    },

    /**
     * Obtient la couleur selon le classement
     */
    getColor(classement) {
        const colors = {
            'top_1': '#006837',
            'top_5': '#1a9641',
            'top_10': '#1a9641',
            'top_25': '#a6d96a',
            'top_50': '#ffffbf',
            'bottom_50': '#fdae61',
            'bottom_25': '#d7191c',
            'bottom_10': '#a50026'
        };
        return colors[classement] || '#999999';
    },

    /**
     * Obtient la catégorie de classement (pour le CSS)
     */
    getRankingCategory(classement) {
        if (['top_1', 'top_5', 'top_10', 'top_25'].includes(classement)) {
            return 'top';
        } else if (classement === 'top_50' || classement === 'bottom_50') {
            return 'middle';
        } else {
            return 'bottom';
        }
    },

    /**
     * Vérifie si un établissement correspond au filtre de classement
     */
    matchesClassementFilter(classement, filter) {
        if (filter === 'tous') return true;

        const ranking = {
            'top_1': 1,
            'top_5': 2,
            'top_10': 3,
            'top_25': 4,
            'top_50': 5,
            'bottom_50': 6,
            'bottom_25': 7,
            'bottom_10': 8
        };

        const etablissementRank = ranking[classement];
        const filterRank = ranking[filter];

        if (!etablissementRank || !filterRank) return true;

        // Pour les filtres "top", on veut tous ceux qui sont au moins aussi bons
        if (filter.startsWith('top')) {
            return etablissementRank <= filterRank;
        }
        // Pour les filtres "bottom", on veut tous ceux qui sont au moins aussi mauvais
        return etablissementRank >= filterRank;
    },

    /**
     * Obtient la moyenne nationale pour un type d'établissement
     */
    getNationalAverage(type, references) {
        const typeKey = type + 's';
        const refType = references?.national?.[typeKey];
        if (!refType) return null;

        if (type === 'ecole') {
            return refType.ips?.tous?.moyenne;
        } else {
            return refType.score_composite?.tous?.moyenne;
        }
    },

    /**
     * Obtient la moyenne départementale pour un établissement
     */
    getDepartmentAverage(etablissement, references) {
        const deptKey = `${etablissement.code_departement}_${etablissement.departement}`;
        const deptRef = references?.par_departement?.[deptKey];
        if (!deptRef) return null;

        const type = etablissement.type;
        if (type === 'ecole') {
            return deptRef.ecoles?.ips?.moyenne;
        } else if (type === 'college') {
            return deptRef.colleges?.score_composite?.moyenne;
        } else {
            return deptRef.lycees?.score_composite?.moyenne;
        }
    },

    /**
     * Formate un nombre pour l'affichage
     */
    formatNumber(num, decimals = 1) {
        if (num === null || num === undefined) return '-';
        return Number(num).toFixed(decimals);
    },

    /**
     * Crée un marqueur circulaire coloré
     */
    createMarkerIcon(color) {
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background-color: ${color};
                width: 18px;
                height: 18px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.4);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });
    },

    /**
     * Extrait les régions uniques des établissements
     */
    extractRegions(etablissements) {
        const regions = new Set();
        etablissements.forEach(e => {
            if (e.region) regions.add(e.region);
        });
        return Array.from(regions).sort();
    },

    /**
     * Extrait les départements uniques des établissements
     */
    extractDepartements(etablissements, region = null) {
        const depts = new Map();
        etablissements.forEach(e => {
            if (e.departement && (!region || e.region === region)) {
                depts.set(e.departement, e.code_departement);
            }
        });
        return Array.from(depts.entries())
            .map(([nom, code]) => ({ code, nom }))
            .sort((a, b) => a.nom.localeCompare(b.nom));
    },

    /**
     * Debounce une fonction
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
