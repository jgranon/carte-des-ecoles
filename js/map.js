/**
 * Gestion de la carte Leaflet
 */

const MapManager = {
    map: null,
    markers: null,
    allMarkers: [],

    /**
     * Initialise la carte
     */
    init() {
        // Créer la carte centrée sur la France
        this.map = L.map('map', {
            center: [46.603354, 1.888334],
            zoom: 6,
            minZoom: 5,
            maxZoom: 18
        });

        // Ajouter les tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        // Créer le cluster de marqueurs
        this.markers = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 15
        });

        this.map.addLayer(this.markers);
    },

    /**
     * Ajoute les établissements à la carte
     */
    addEtablissements(etablissements, references) {
        this.allMarkers = [];
        this.references = references;

        // Regrouper les établissements par coordonnées
        const groupedByLocation = new Map();

        etablissements.forEach(etab => {
            if (!etab.latitude || !etab.longitude) return;

            const key = `${etab.latitude.toFixed(6)}_${etab.longitude.toFixed(6)}`;
            if (!groupedByLocation.has(key)) {
                groupedByLocation.set(key, []);
            }
            groupedByLocation.get(key).push(etab);
        });

        // Créer un marqueur par groupe
        groupedByLocation.forEach((group, key) => {
            const firstEtab = group[0];

            // Calculer le meilleur classement du groupe pour la couleur
            let bestClassement = null;
            let bestRank = 999;
            const rankOrder = ['top_1', 'top_5', 'top_10', 'top_25', 'top_50', 'bottom_50', 'bottom_25', 'bottom_10'];

            group.forEach(etab => {
                const classement = Utils.classify(etab, references);
                const rank = rankOrder.indexOf(classement);
                if (rank !== -1 && rank < bestRank) {
                    bestRank = rank;
                    bestClassement = classement;
                }
            });

            const color = Utils.getColor(bestClassement);
            const icon = Utils.createMarkerIcon(color);

            const marker = L.marker([firstEtab.latitude, firstEtab.longitude], { icon });

            // Stocker tous les établissements du groupe
            marker.etablissements = group;
            marker.classement = bestClassement;

            // Créer le popup avec onglets si plusieurs établissements
            marker.bindPopup(() => this.createGroupPopupContent(group, references), {
                maxWidth: 320,
                className: group.length > 1 ? 'popup-with-tabs' : ''
            });

            this.allMarkers.push(marker);
        });

        this.markers.addLayers(this.allMarkers);
    },

    /**
     * Crée le contenu du popup pour un groupe d'établissements
     */
    createGroupPopupContent(group, references) {
        if (group.length === 1) {
            const etab = group[0];
            const classement = Utils.classify(etab, references);
            return this.createPopupContent(etab, classement, references);
        }

        // Trier par type : école, collège, lycée
        const typeOrder = { 'ecole': 1, 'college': 2, 'lycee': 3 };
        const sortedGroup = [...group].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

        const typeLabels = {
            'ecole': 'École',
            'college': 'Collège',
            'lycee': 'Lycée'
        };

        // Créer les onglets
        const tabs = sortedGroup.map((etab, index) => {
            const isActive = index === 0 ? 'active' : '';
            return `<button class="popup-tab ${isActive}" data-index="${index}">${typeLabels[etab.type]}</button>`;
        }).join('');

        // Créer les contenus
        const contents = sortedGroup.map((etab, index) => {
            const classement = Utils.classify(etab, references);
            const isActive = index === 0 ? 'active' : '';
            return `<div class="popup-tab-content ${isActive}" data-index="${index}">
                ${this.createPopupContentInner(etab, classement, references)}
            </div>`;
        }).join('');

        const html = `
            <div class="popup-tabbed">
                <div class="popup-tabs">${tabs}</div>
                <div class="popup-tabs-content">${contents}</div>
            </div>
        `;

        // Ajouter les événements après que le popup soit affiché
        setTimeout(() => {
            document.querySelectorAll('.popup-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const index = e.target.dataset.index;
                    document.querySelectorAll('.popup-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.popup-tab-content').forEach(c => c.classList.remove('active'));
                    e.target.classList.add('active');
                    document.querySelector(`.popup-tab-content[data-index="${index}"]`).classList.add('active');
                });
            });
        }, 10);

        return html;
    },

    /**
     * Crée le contenu HTML du popup (avec wrapper)
     */
    createPopupContent(etab, classement, references) {
        return `<div class="popup-content">${this.createPopupContentInner(etab, classement, references)}</div>`;
    },

    /**
     * Crée le contenu intérieur du popup (sans wrapper, pour les onglets)
     */
    createPopupContentInner(etab, classement, references) {
        const score = Utils.getScore(etab);
        const scoreLabel = Utils.getScoreLabel(etab.type);
        const scoreUnit = Utils.getScoreUnit(etab.type);
        const rankingLabel = Utils.getClassementLabel(classement);
        const rankingCategory = Utils.getRankingCategory(classement);

        const nationalAvg = Utils.getNationalAverage(etab.type, references);
        const deptAvg = Utils.getDepartmentAverage(etab, references);

        const typeLabels = {
            'ecole': 'École',
            'college': 'Collège',
            'lycee': 'Lycée'
        };

        const secteurLabels = {
            'public': 'Public',
            'prive': 'Privé'
        };

        // Tooltip pour expliquer le score (écoles et lycées uniquement)
        const scoreTooltip = etab.type === 'ecole'
            ? "Indice de Position Sociale : indicateur synthétique du niveau socio-économique des élèves"
            : "Score composite = taux de réussite × taux de mentions (toutes séries)";

        // N'afficher le score que pour les écoles (IPS). Pour collèges/lycées, le score sert uniquement au classement.
        const showScore = etab.type === 'ecole';

        // Taux de réussite pour collèges et lycées
        let tauxReussiteHtml = '';
        if (etab.type === 'college' && etab.scores?.taux_reussite_brevet) {
            tauxReussiteHtml = `
                <div class="popup-taux-reussite">
                    <span class="taux-label">Taux de réussite au brevet</span>
                    <span class="taux-value">${Utils.formatNumber(etab.scores.taux_reussite_brevet)}%</span>
                </div>
            `;
        } else if (etab.type === 'lycee' && etab.scores?.taux_reussite_bac) {
            tauxReussiteHtml = `
                <div class="popup-taux-reussite">
                    <span class="taux-label">Taux de réussite au bac</span>
                    <span class="taux-value">${Utils.formatNumber(etab.scores.taux_reussite_bac)}%</span>
                </div>
            `;
        }

        // Mentions pour collèges et lycées
        let mentionsHtml = '';
        if (etab.type === 'college' && etab.mentions) {
            const nbCandidats = etab.scores?.nb_candidats || 0;
            const mentions = etab.mentions;
            if (nbCandidats > 0 && mentions.nb_mentions_total) {
                const tauxTotal = ((mentions.nb_mentions_total / nbCandidats) * 100).toFixed(1);
                const tauxTB = mentions.nb_mentions_tb ? ((mentions.nb_mentions_tb / nbCandidats) * 100).toFixed(1) : '-';
                const tauxB = mentions.nb_mentions_b ? ((mentions.nb_mentions_b / nbCandidats) * 100).toFixed(1) : '-';
                const tauxAB = mentions.nb_mentions_ab ? ((mentions.nb_mentions_ab / nbCandidats) * 100).toFixed(1) : '-';
                mentionsHtml = `
                    <div class="popup-mentions">
                        <div class="popup-mentions-title">Mentions</div>
                        <div class="popup-mentions-grid">
                            <span class="mention-label">Très Bien</span><span class="mention-value">${tauxTB}%</span>
                            <span class="mention-label">Bien</span><span class="mention-value">${tauxB}%</span>
                            <span class="mention-label">Assez Bien</span><span class="mention-value">${tauxAB}%</span>
                            <span class="mention-label total">Total mentions</span><span class="mention-value total">${tauxTotal}%</span>
                        </div>
                    </div>
                `;
            }
        } else if (etab.type === 'lycee' && etab.mentions) {
            const nbPresents = etab.scores?.nb_presents || 0;
            const mentions = etab.mentions;

            if (nbPresents > 0) {
                const nbTB = (mentions.nb_mentions_tb_fel || 0) + (mentions.nb_mentions_tb || 0);
                const nbB = mentions.nb_mentions_b || 0;
                const nbAB = mentions.nb_mentions_ab || 0;
                const nbTotal = nbTB + nbB + nbAB;

                const tauxTB = nbTB > 0 ? ((nbTB / nbPresents) * 100).toFixed(1) : '-';
                const tauxB = nbB > 0 ? ((nbB / nbPresents) * 100).toFixed(1) : '-';
                const tauxAB = nbAB > 0 ? ((nbAB / nbPresents) * 100).toFixed(1) : '-';
                const tauxTotal = nbTotal > 0 ? ((nbTotal / nbPresents) * 100).toFixed(1) : (mentions.taux_mentions ? Utils.formatNumber(mentions.taux_mentions) : '-');

                mentionsHtml = `
                    <div class="popup-mentions">
                        <div class="popup-mentions-title">Mentions</div>
                        <div class="popup-mentions-grid">
                            <span class="mention-label">Très Bien</span><span class="mention-value">${tauxTB}%</span>
                            <span class="mention-label">Bien</span><span class="mention-value">${tauxB}%</span>
                            <span class="mention-label">Assez Bien</span><span class="mention-value">${tauxAB}%</span>
                            <span class="mention-label total">Total mentions</span><span class="mention-value total">${tauxTotal}%</span>
                        </div>
                    </div>
                `;
            } else if (mentions.taux_mentions) {
                mentionsHtml = `
                    <div class="popup-mentions">
                        <div class="popup-mentions-title">Taux de mentions</div>
                        <div class="popup-mentions-value">${Utils.formatNumber(mentions.taux_mentions)}%</div>
                    </div>
                `;
            }
        }

        return `
            <div class="popup-header">
                <div class="popup-name">${etab.nom}</div>
                <span class="popup-type ${etab.type}">${typeLabels[etab.type]}</span>
                <span class="popup-secteur ${etab.secteur}">${secteurLabels[etab.secteur]}</span>
            </div>
            <div class="popup-location">
                ${etab.commune}, ${etab.departement}
            </div>
            <div class="popup-ranking-main ${rankingCategory}">
                <div class="popup-ranking-label">${rankingLabel}</div>
                ${etab.rang ? `<div class="popup-rang-main">${etab.rang}<sup>${this.getOrdinalSuffix(etab.rang)}</sup> <span class="popup-rang-total">/ ${etab.total_type.toLocaleString('fr-FR')}</span></div>` : ''}
            </div>
            ${showScore ? `
            <div class="popup-score" title="${scoreTooltip}">
                <div class="popup-score-label">${scoreLabel} <span class="info-icon">ⓘ</span></div>
                <span class="popup-score-value">${Utils.formatNumber(score)}</span>
                <span class="popup-score-unit">${scoreUnit}</span>
            </div>
            ` : ''}
            ${tauxReussiteHtml}
            ${mentionsHtml}
            ${showScore ? `
            <div class="popup-comparison">
                <p>Moyenne nationale : ${Utils.formatNumber(nationalAvg)}${scoreUnit}</p>
                ${deptAvg ? `<p>Moyenne ${etab.departement} : ${Utils.formatNumber(deptAvg)}${scoreUnit}</p>` : ''}
            </div>
            ` : ''}
        `;
    },

    /**
     * Met à jour les marqueurs affichés selon les filtres
     */
    updateMarkers(filteredMarkers) {
        this.markers.clearLayers();
        this.markers.addLayers(filteredMarkers);
    },

    /**
     * Obtient tous les marqueurs
     */
    getAllMarkers() {
        return this.allMarkers;
    },

    /**
     * Zoom sur un établissement
     */
    zoomToEtablissement(etab) {
        if (!etab.latitude || !etab.longitude) return;

        this.map.setView([etab.latitude, etab.longitude], 16);

        // Trouver le marqueur contenant cet établissement
        const marker = this.allMarkers.find(m => {
            const etablissements = m.etablissements || [];
            return etablissements.some(e => e.uai === etab.uai);
        });

        if (marker) {
            // Attendre que le cluster soit dégroupé
            setTimeout(() => {
                marker.openPopup();
            }, 500);
        }
    },

    /**
     * Recentre la carte sur la France
     */
    resetView() {
        this.map.setView([46.603354, 1.888334], 6);
    },

    /**
     * Retourne le suffixe ordinal français (er, e, ème)
     */
    getOrdinalSuffix(n) {
        if (n === 1) return 'er';
        return 'e';
    }
};
