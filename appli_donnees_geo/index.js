var app = new Vue({
    el: '#app',
    data: {
        startLocation: '',
        endLocation: '',
        startSuggestions: [],
        endSuggestions: [],
        transportType: 0,
        currentLocation: { name: '', lat: '', lon: '' },
        map: null,
        colors: ['blue', 'red', 'green', 'purple', 'orange', 'pink', 'brown', 'cyan', 'magenta', 'yellow'],
        marker: null,
        numParts: 1,
        routeLayers: [], // Tableau pour stocker les chemins ajoutés
        waypoints: [],
        generateRouteActive: false, // Nouvelle propriété pour gérer l'activation/désactivation de la génération de route
        fileWaypoints: [] // Nouveau tableau pour stocker les points de départ et d'arrivée des fichiers GPX
    },
    mounted() {
        this.initialiserMap();
        document.addEventListener('keydown', this.handleShortcut);
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.handleShortcut);
    },
    methods: {
        initialiserMap() {
            this.map = L.map('map').setView([48.8566, 2.3522], 13); // Paris par défaut

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            this.map.on('click', this.on_map_click);

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.map.setView([position.coords.latitude, position.coords.longitude], 13);
                    },
                    () => {
                        console.error('Impossible de récupérer la localisation actuelle.');
                    }
                );
            }
        },
        on_map_click(e) {
            if (!this.generateRouteActive) return;

            var lat = e.latlng.lat;
            var lon = e.latlng.lng;

            if (this.marker) {
                this.map.removeLayer(this.marker);
            }

            this.marker = L.marker([lat, lon]).addTo(this.map)
                .bindPopup(`<b>Coordonnées :</b><br>Latitude: ${lat}<br>Longitude: ${lon}`)
                .openPopup();

            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                .then(response => response.json())
                .then(data => {
                    var address = data.display_name;
                    if (this.waypoints.length === 0) {
                        this.startLocation = address;
                        this.waypoints.push([lat, lon]);
                    } else if (this.waypoints.length === 1) {
                        this.endLocation = address;
                        this.waypoints.push([lat, lon]);
                        this.trouverChemin();
                    } else {
                        this.startLocation = this.endLocation;
                        this.endLocation = address;
                        this.waypoints = [this.waypoints[this.waypoints.length - 1], [lat, lon]];
                        this.trouverChemin();
                    }
                    this.currentLocation = { name: address, lat: lat, lon: lon };
                })
                .catch(error => console.error('Erreur lors de la récupération de l\'adresse:', error));
        },
        imprimer() {
            if (this.routeLayers.length === 0) {
                alert('Aucun chemin disponible pour exporter.');
                return;
            }

            this.exporterChemins();
        },
        exporterChemins() {
            const selectedLayers = this.routeLayers.filter(layer => layer.selected);
            if (selectedLayers.length === 0) {
                alert('Aucun chemin sélectionné pour exporter.');
                return;
            }

            selectedLayers.forEach((layer, index) => {
                this.exportGPX(layer, index);
            });
        },

        exportGPX(layer, index) {
    // Utiliser l'URL du fichier GPX au lieu de tenter de convertir les coordonnées
    const gpxData = layer.gpxData; // Assurez-vous que vous avez stocké les données GPX dans layer.gpxData
    if (gpxData) {
        fetch(gpxData)
            .then(response => response.text())
            .then(data => {
                console.log('Contenu GPX:', data); // Ajoutez ce log pour vérifier le contenu GPX
                const blob = new Blob([data], { type: 'application/gpx+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `chemin_${index + 1}.gpx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(error => console.error('Erreur lors de la récupération des données GPX:', error));
    } else {
        console.error('Erreur: Les données GPX ne sont pas disponibles pour ce chemin.');
    }
},


        fetchSuggestions(type) {
            let query = type === 'start' ? this.startLocation : this.endLocation;
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
                .then(response => response.json())
                .then(data => {
                    if (type === 'start') {
                        this.startSuggestions = data;
                    } else {
                        this.endSuggestions = data;
                    }
                })
                .catch(error => console.error('Erreur:', error));
        },
        zoomToLocation(type) {
            let query = type === 'start' ? this.startLocation : this.endLocation;
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        var lat = data[0].lat;
                        var lon = data[0].lon;
                        var name = data[0].display_name;
                        this.map.setView([lat, lon], 13);
                        if (this.marker) {
                            this.map.removeLayer(this.marker);
                        }
                        this.marker = L.marker([lat, lon]).addTo(this.map)
                            .bindPopup(`<b>${name}</b><br><b>latitude : ${lat}</b><br><b>longitude : ${lon}</b>`)
                            .openPopup();
                        this.currentLocation = { name: name, lat: lat, lon: lon };
                    } else {
                        alert("Lieu non trouvé");
                    }
                })
                .catch(error => console.error('Erreur:', error));
        },
        trouverChemin() {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.startLocation}`)
                .then(response => response.json())
                .then(dataStart => {
                    if (dataStart && dataStart.length > 0) {
                        var startLat = dataStart[0].lat;
                        var startLon = dataStart[0].lon;

                        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.endLocation}`)
                            .then(response => response.json())
                            .then(dataEnd => {
                                if (dataEnd && dataEnd.length > 0) {
                                    var endLat = dataEnd[0].lat;
                                    var endLon = dataEnd[0].lon;

                                    fetch(`http://localhost:8000/api/?lat1=${startLat}&lon1=${startLon}&lat2=${endLat}&lon2=${endLon}&type=${this.transportType}`)
                                        .then(response => {
                                            if (!response.ok) {
                                                throw new Error('Erreur lors de la récupération du fichier GPX');
                                            }
                                            return response.blob();
                                        })
                                        .then(blob => {
                                            const url = URL.createObjectURL(blob);
                                            const routeLayer = new L.GPX(url, {
                                                async: true
                                            }).on('loaded', (e) => {
                                                this.map.fitBounds(e.target.getBounds());
                                                URL.revokeObjectURL(url);
                                            }).addTo(this.map);
                                            routeLayer.selected = false; // Initialement non sélectionné
                                            routeLayer.gpxData = URL.createObjectURL(blob); // Stocker l'URL du fichier GPX pour l'exportation
                                            this.routeLayers.push(routeLayer);
                                        })
                                        .catch(error => {
                                            console.error('Erreur lors de l\'appel à l\'API ou du chargement du GPX:', error);
                                        });
                                } else {
                                    alert("Lieu d'arrivée non trouvé");
                                }
                            });
                    } else {
                        alert("Lieu de départ non trouvé");
                    }
                })
                .catch(error => console.error('Erreur:', error));
        },
        animerChemin(coordinates) {
            let index = 0;
            const polyline = L.polyline([], { color: 'blue' }).addTo(this.map);
            const addPoint = () => {
                if (index < coordinates.length) {
                    polyline.addLatLng([coordinates[index][1], coordinates[index][0]]);
                    index++;
                    setTimeout(addPoint, 100); // vitesse
                }
            };
            addPoint();
        },
        chargerGPX(event) {
            const files = event.target.files;
            if (!files) {
                return;
            }

            let allWaypoints = [];
            let fileWaypoints = [];

            Array.from(files).forEach((file, fileIndex) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const gpxData = e.target.result;
                    const parser = new DOMParser();
                    const gpxDoc = parser.parseFromString(gpxData, "application/xml");
                    const trackPoints = gpxDoc.querySelectorAll('trkpt');

                    if (trackPoints.length > 0) {
                        const firstPoint = trackPoints[0];
                        const lastPoint = trackPoints[trackPoints.length - 1];

                        const firstLat = parseFloat(firstPoint.getAttribute('lat'));
                        const firstLon = parseFloat(firstPoint.getAttribute('lon'));
                        const lastLat = parseFloat(lastPoint.getAttribute('lat'));
                        const lastLon = parseFloat(lastPoint.getAttribute('lon'));

                        fileWaypoints.push({ start: [firstLat, firstLon], end: [lastLat, lastLon] });

                        const routeLayer = new L.GPX(gpxData, {
                            async: true
                        }).on('loaded', (e) => {
                            this.map.fitBounds(e.target.getBounds());
                        }).addTo(this.map);
                        routeLayer.selected = false; // Initialement non sélectionné
                        routeLayer.gpxData = gpxData; // Stocker les données GPX pour l'exportation
                        this.routeLayers.push(routeLayer);

                        for (let i = 0; i < trackPoints.length; i++) {
                            const point = trackPoints[i];
                            const lat = parseFloat(point.getAttribute('lat'));
                            const lon = parseFloat(point.getAttribute('lon'));
                            allWaypoints.push([lat, lon]);
                        }
                    } else {
                        alert(`Le fichier GPX ${file.name} ne contient pas de points de piste.`);
                    }

                    if (fileIndex === files.length - 1) {
                        this.fileWaypoints = fileWaypoints;
                        if (this.fileWaypoints.length > 1) {
                            this.traceCheminEntreFiles();
                        } else if (allWaypoints.length > 0) {
                            this.animerChemin(allWaypoints);
                        }
                    }
                };
                reader.readAsText(file);
            });
        },
        traceCheminEntreFiles() {
            const fileWaypoints = this.fileWaypoints;
            for (let i = 0; i < fileWaypoints.length - 1; i++) {
                const start = fileWaypoints[i].end;
                const end = fileWaypoints[i + 1].start;
                this.tracerChemin(start, end);
            }
        },
        tracerChemin(start, end) {
            const [startLat, startLon] = start;
            const [endLat, endLon] = end;

            fetch(`http://localhost:8000/api/?lat1=${startLat}&lon1=${startLon}&lat2=${endLat}&lon2=${endLon}&type=${this.transportType}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erreur lors de la récupération du fichier GPX');
                    }
                    return response.blob();
                })
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    const routeLayer = new L.GPX(url, {
                        async: true
                    }).on('loaded', (e) => {
                        this.map.fitBounds(e.target.getBounds());
                        URL.revokeObjectURL(url);
                    }).addTo(this.map);
                    routeLayer.selected = false; // Initialement non sélectionné
                    routeLayer.gpxData = URL.createObjectURL(blob); // Stocker l'URL du fichier GPX pour l'exportation
                    this.routeLayers.push(routeLayer);
                })
                .catch(error => {
                    console.error('Erreur lors de l\'appel à l\'API ou du chargement du GPX:', error);
                });
        },
        toggleGenerateRoute() {
            this.generateRouteActive = !this.generateRouteActive;
        },
        selectTransportType(type) {
            this.transportType = type;
        },
        handleShortcut(event) {
            if (event.key === 'Enter' && this.generateRouteActive) {
                this.trouverChemin();
            }
        },
        toggleSelectRoute(layer) {
            layer.selected = !layer.selected;
        },

        découperChemin(layer, point) {
        const latlngs = layer.getLatLngs();
        let closestIndex = -1;
        let closestDistance = Infinity;

        // Trouver le point le plus proche sur le chemin
        for (let i = 0; i < latlngs.length - 1; i++) {
            const p1 = latlngs[i];
            const p2 = latlngs[i + 1];
            const dist = this.distanceToSegment(point, p1, p2);
            if (dist < closestDistance) {
                closestDistance = dist;
                closestIndex = i;
            }
        }

        if (closestIndex >= 0) {
            // Découper le chemin
            const newLatlngs1 = latlngs.slice(0, closestIndex + 1);
            const newLatlngs2 = latlngs.slice(closestIndex + 1);

            // Créer deux nouveaux chemins avec des couleurs différentes
            const newLayer1 = L.polyline(newLatlngs1, { color: 'blue' }).addTo(this.map);
            const newLayer2 = L.polyline(newLatlngs2, { color: 'red' }).addTo(this.map);

            // Supprimer l'ancien chemin
            this.map.removeLayer(layer);

            // Ajouter les nouveaux chemins à la liste des chemins
            this.routeLayers.push(newLayer1);
            this.routeLayers.push(newLayer2);
        }
    },

    // Méthode pour calculer la distance d'un point à un segment de ligne
    distanceToSegment(point, p1, p2) {
        const x = point.lat;
        const y = point.lng;
        const x1 = p1.lat;
        const y1 = p1.lng;
        const x2 = p2.lat;
        const y2 = p2.lng;

        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx === 0 && dy === 0) {
            return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
        }

        const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
        const tx = Math.max(x1, Math.min(x1 + t * dx, x2));
        const ty = Math.max(y1, Math.min(y1 + t * dy, y2));

        return Math.sqrt((x - tx) ** 2 + (y - ty) ** 2);
    },

    // Méthode appelée lorsqu'on clique sur un chemin
    onCheminClick(e) {
        if (!this.generateRouteActive) return;

        const layer = e.target;
        if (layer instanceof L.Polyline) {
            this.map.once('click', (event) => {
                this.découperChemin(layer, event.latlng);
            });
        }
    },

    // Méthode pour activer le découpage
    toggleDecoupage() {
        this.generateRouteActive = !this.generateRouteActive;
        if (this.generateRouteActive) {
            this.routeLayers.forEach((layer) => {
                layer.on('click', this.onCheminClick);
            });
        } else {
            this.routeLayers.forEach((layer) => {
                layer.off('click', this.onCheminClick);
            });
        }
    }
    }
});
