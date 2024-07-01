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
        fileWaypoints: [], // Nouveau tableau pour stocker les points de départ et d'arrivée des fichiers GPX
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
        imprimerGPX() {
            if (this.routeLayers.length === 0) {
                alert('Aucun chemin disponible pour exporter.');
                return;
            }

            this.exporterCheminsGPX();
        },
        imprimerKML() {
            if (this.routeLayers.length === 0) {
                alert('Aucun chemin disponible pour exporter.');
                return;
            }

            this.exporterCheminsKML();
        },
        exporterCheminsGPX() {
            const selectedLayers = this.routeLayers.filter(layer => layer.selected);
            if (selectedLayers.length === 0) {
                alert('Aucun chemin sélectionné pour exporter.');
                return;
            }
        
            selectedLayers.forEach((layer) => {
                this.exportGPX(layer);
            });
        },        
        exporterCheminsKML() {
            const selectedLayers = this.routeLayers.filter(layer => layer.selected);
            if (selectedLayers.length === 0) {
                alert('Aucun chemin sélectionné pour exporter.');
                return;
            }
        
            selectedLayers.forEach((layer) => {
                this.exportKML(layer);
            });
        },        

        exportGPX(layer) {
            const gpxData = layer.gpxData;
            const startPoint = layer.startPoint; // Coordonnées du point de départ
            const endPoint = layer.endPoint; // Coordonnées du point d'arrivée
        
            if (layer.selected && gpxData && startPoint && endPoint) {
                fetch(gpxData)
                    .then(response => response.text())
                    .then(data => {
                        // Ajouter les coordonnées du point de départ (startPoint)
                        data = data.replace('<trkseg>', `<trkseg><trkpt lat="${startPoint.lat}" lon="${startPoint.lon}">`);
                        
                        // Ajouter les coordonnées du point d'arrivée (endPoint) à la fin
                        const lastIndex = data.lastIndexOf('</trkpt>');
                        data = data.substring(0, lastIndex) + `<trkpt lat="${endPoint.lat}" lon="${endPoint.lon}"></trkpt>` + data.substring(lastIndex);
        
                        const blob = new Blob([data], { type: 'application/gpx+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `trajet_${layer.startLocation.replace(/ /g, "_")}_${layer.endLocation.replace(/ /g, "_")}.gpx`; // Utilisation du nom de chemin fourni
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    })
                    .catch(error => console.error('Erreur lors de la récupération des données GPX:', error));
            } else {
                console.error('Erreur: Les données GPX ne sont pas disponibles pour ce chemin ou il n\'est pas sélectionné.');
            }
        },
        
        exportKML(layer) {
            const gpxData = layer.gpxData;
            const startPoint = layer.startPoint; // Coordonnées du point de départ
            const endPoint = layer.endPoint; // Coordonnées du point d'arrivée
        
            if (layer.selected && gpxData && startPoint && endPoint) {
                fetch(gpxData)
                    .then(response => response.text())
                    .then(data => {
                        // Convertir les données GPX en KML
                        const kmlData = this.convertGPXtoKML(data, startPoint, endPoint);
        
                        const blob = new Blob([kmlData], { type: 'application/vnd.google-earth.kml+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `trajet_${layer.startLocation.replace(/ /g, "_")}_${layer.endLocation.replace(/ /g, "_")}.kml`; // Utilisation du nom de chemin fourni
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    })
                    .catch(error => console.error('Erreur lors de la récupération des données GPX:', error));
            } else {
                console.error('Erreur: Les données GPX ne sont pas disponibles pour ce chemin ou il n\'est pas sélectionné.');
            }
        },
        convertGPXtoKML(gpxData, startPoint, endPoint) {
            // Fonction pour convertir les données GPX en KML
            const parser = new DOMParser();
            const gpxDoc = parser.parseFromString(gpxData, "application/xml");
            const trackPoints = gpxDoc.querySelectorAll('trkpt');
        
            let kml = `<?xml version="1.0" encoding="UTF-8"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
            <Document>
                <name>Route</name>
                <description>Route exportée depuis GPX</description>
                <Style id="lineStyle">
                    <LineStyle>
                        <color>ff0000ff</color>
                        <width>4</width>
                    </LineStyle>
                </Style>
                <Placemark>
                    <name>Route</name>
                    <description>Route exportée depuis GPX</description>
                    <styleUrl>#lineStyle</styleUrl>
                    <LineString>
                        <coordinates>
                            ${startPoint.lon},${startPoint.lat},0\n`;
        
            trackPoints.forEach(point => {
                const lat = point.getAttribute('lat');
                const lon = point.getAttribute('lon');
                kml += `\t\t\t${lon},${lat},0\n`;
            });
        
            kml += `\t\t\t${endPoint.lon},${endPoint.lat},0\n`;
            kml += `</coordinates>
                    </LineString>
                </Placemark>
            </Document>
            </kml>`;
        
            return kml;
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

                                            // Stocker les coordonnées du point de départ et du point d'arrivée dans la couche de route
                                            routeLayer.startPoint = { lat: startLat, lon: startLon };
                                            routeLayer.endPoint = { lat: endLat, lon: endLon };
                                            routeLayer.startLocation = this.startLocation;
                                            routeLayer.endLocation = this.endLocation;
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
        
                        fileWaypoints.push({ start: { lat: firstLat, lon: firstLon }, end: { lat: lastLat, lon: lastLon } });
        
                        const routeIndex = this.routeLayers.length + 1; // Index du chemin actuel
                        const routeName = `chemin_${routeIndex}`; // Nom du chemin basé sur l'index
                        const routeLayer = new L.GPX(gpxData, {
                            async: true
                        }).on('loaded', (e) => {
                            this.map.fitBounds(e.target.getBounds());
                        }).addTo(this.map);
                        routeLayer.selected = false; // Initialement non sélectionné
                        routeLayer.gpxData = gpxData; // Stocker les données GPX pour l'exportation
                        routeLayer.routeName = routeName; // Stocker le nom du chemin dans la couche
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
