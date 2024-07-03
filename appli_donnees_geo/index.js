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
        exportFormat: 'gpx' // Ajout de la variable exportFormat
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

            if (this.exportFormat === 'gpx') {
                this.exporterCheminsGPX();
                this.exporterCheminsKML();
            } else {
                alert('Format d\'exportation non valide.');
            }
        },
        exporterCheminsGPX() {
            const selectedLayers = this.routeLayers.filter(layer => layer.selected);
            if (selectedLayers.length === 0) {
                alert('Aucun chemin sélectionné pour exporter.');
                return;
            }

            // Créer un conteneur pour les données GPX combinées
            let combinedGPXData = `<?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
            <metadata>
                <name>Chemins Exportés</name>
                <desc>Fichier GPX combiné de tous les chemins sélectionnés</desc>
            </metadata>
            <trk>
                <name>Chemins Exportés</name>
                <trkseg>`;

            selectedLayers.forEach(layer => {
                if (layer.gpxData) {
                    fetch(layer.gpxData)
                        .then(response => response.text())
                        .then(data => {
                            const parser = new DOMParser();
                            const gpxDoc = parser.parseFromString(data, "application/xml");
                            const trackPoints = gpxDoc.querySelectorAll('trkpt');

                            // Extraire les points de chaque GPX et les ajouter au conteneur
                            trackPoints.forEach(point => {
                                const lat = point.getAttribute('lat');
                                const lon = point.getAttribute('lon');
                                combinedGPXData += `<trkpt lat="${lat}" lon="${lon}"></trkpt>`;
                            });

                            // fermer les balises
                            if (layer === selectedLayers[selectedLayers.length - 1]) {
                                combinedGPXData += `</trkseg></trk></gpx>`;
                                const blob = new Blob([combinedGPXData], { type: 'application/gpx+xml' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'chemins_composes.gpx';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }
                        })
                        .catch(error => console.error('Erreur lors de la récupération des données GPX:', error));
                }
            });
        },

        exporterCheminsKML() {
            const selectedLayers = this.routeLayers.filter(layer => layer.selected);
            if (selectedLayers.length === 0) {
                alert('Aucun chemin sélectionné pour exporter.');
                return;
            }

            // Créer un conteneur pour les données KML combinées
            let combinedKMLData = `<?xml version="1.0" encoding="UTF-8"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
            <Document>
                <name>Chemins Exportés</name>
                <description>Fichier KML combiné de tous les chemins sélectionnés</description>
                <Style id="lineStyle">
                    <LineStyle>
                        <color>ff0000ff</color>
                        <width>4</width>
                    </LineStyle>
                </Style>`;

            selectedLayers.forEach(layer => {
                if (layer.gpxData) {
                    fetch(layer.gpxData)
                        .then(response => response.text())
                        .then(data => {
                            const kmlData = this.convertGPXtoKML(data, layer.startPoint, layer.endPoint);
                            
                            // Ajouter les données KML converties au conteneur
                            combinedKMLData += kmlData;
                            
                            // fermer les balises
                            if (layer === selectedLayers[selectedLayers.length - 1]) {
                                combinedKMLData += `</Document></kml>`;
                                const blob = new Blob([combinedKMLData], { type: 'application/vnd.google-earth.kml+xml' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'chemins_composes.kml';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }
                        })
                        .catch(error => console.error('Erreur lors de la récupération des données GPX:', error));
                }
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
                        data = data.replace('<trkseg>', `<trkseg><trkpt lat="${startPoint.lat}" lon="${startPoint.lon}"></trkpt>`);

                        // Ajouter les coordonnées du point d'arrivée (endPoint) à la fin
                        data = data.replace('</trkseg>', `<trkpt lat="${endPoint.lat}" lon="${endPoint.lon}"></trkpt></trkseg>`);

                        const blob = new Blob([data], { type: 'application/gpx+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `trajet_${layer.startLocation.replace(/ /g, "_")}_${layer.endLocation.replace(/ /g, "_")}.gpx`;
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
                        a.download = `trajet_${layer.startLocation.replace(/ /g, "_")}_${layer.endLocation.replace(/ /g, "_")}.kml`;
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

                kml += `\t\t\t\t\t\t\t${lon},${lat},0\n`;
            });

            kml += `\t\t\t\t\t\t\t${endPoint.lon},${endPoint.lat},0\n
                            </coordinates>
                        </LineString>
                    </Placemark>
                </Document>
            </kml>`;

            return kml;
        }
        ,
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
                                                async: true,
                                                marker_options: {
                                                    startIconUrl: 'https://leafletjs.com/examples/custom-icons/leaf-green.png',
                                                    endIconUrl: 'https://leafletjs.com/examples/custom-icons/leaf-red.png',
                                                    shadowUrl: 'https://leafletjs.com/examples/custom-icons/leaf-shadow.png'
                                                },
                                                polyline_options: {
                                                    color: this.colors[this.routeLayers.length % this.colors.length]
                                                }
                                            }).on('loaded', e => {
                                                this.map.fitBounds(e.target.getBounds());
                                                
                                                // Stocker les coordonnées du point de départ et du point d'arrivée
                                                routeLayer.startPoint = { lat: startLat, lon: startLon };
                                                routeLayer.endPoint = { lat: endLat, lon: endLon };
                                                routeLayer.startLocation = this.startLocation;
                                                routeLayer.endLocation = this.endLocation;
                                                routeLayer.selected = false; 
                                                routeLayer.gpxData = url; 

                                                // Ajouter la couche à la carte et au tableau
                                                routeLayer.addTo(this.map);
                                                this.routeLayers.push(routeLayer);
                                            });
                                        })
                                        .catch(error => console.error('Erreur lors de la récupération du fichier GPX:', error));
                                } else {
                                    alert('Lieu de fin non trouvé');
                                }
                            })
                            .catch(error => console.error('Erreur lors de la récupération du lieu de fin:', error));
                    } else {
                        alert('Lieu de début non trouvé');
                    }
                })
                .catch(error => console.error('Erreur lors de la récupération du lieu de début:', error));
        },

        convertKMLtoGPX(kmlDoc) {
            const trackPoints = kmlDoc.querySelectorAll('Placemark LineString coordinates');
            let gpxData = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="OpenAI"><trk><trkseg>`;

            trackPoints.forEach(point => {
                const coords = point.textContent.trim().split(/\s+/);
                coords.forEach(coord => {
                    const [lon, lat] = coord.split(',').map(Number);
                    gpxData += `<trkpt lat="${lat}" lon="${lon}"></trkpt>`;
                });
            });

            gpxData += `</trkseg></trk></gpx>`;
            return gpxData;
        },

        chargerGPXKML(event) {
            const files = event.target.files;
            if (!files) {
                return;
            }

            let fileWaypoints = [];

            Array.from(files).forEach((file) => {
                const reader = new FileReader();

                reader.onload = (e) => {
                    const fileData = e.target.result;

                    if (file.name.endsWith('.gpx')) {
                        this.processGPX(fileData, fileWaypoints);
                    } else if (file.name.endsWith('.kml')) {
                        this.processKML(fileData, fileWaypoints);
                    } else {
                        alert(`Format de fichier non supporté: ${file.name}`);
                    }

                    // Après traitement de tous les fichiers
                    if (file === files[files.length - 1]) {
                        this.fileWaypoints = fileWaypoints;
                        if (this.fileWaypoints.length > 1) {
                            this.traceCheminEntreFiles();
                        }
                    }
                };

                reader.readAsText(file);
            });
        },
        processGPX(gpxData, fileWaypoints) {
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

                const routeLayer = new L.GPX(gpxData, { async: true }).on('loaded', (e) => {
                    this.map.fitBounds(e.target.getBounds());
                }).addTo(this.map);

                routeLayer.selected = false;
                routeLayer.gpxData = gpxData; // Stocker les données GPX pour l'exportation
                this.routeLayers.push(routeLayer);
            } else {
                alert('Le fichier GPX ne contient pas de points de piste.');
            }
        },
        processKML(kmlData, fileWaypoints) {
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(kmlData, "application/xml");

            // Convertir KML en GPX
            const gpxData = this.convertKMLtoGPX(kmlDoc);
            this.processGPX(gpxData, fileWaypoints);
        },
        convertKMLtoGPX(kmlDoc) {
            const trackPoints = kmlDoc.querySelectorAll('Placemark LineString coordinates');
            let gpxData = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="OpenAI"><trk><trkseg>`;

            trackPoints.forEach(point => {
                const coords = point.textContent.trim().split(/\s+/);
                coords.forEach(coord => {
                    const [lon, lat] = coord.split(',').map(Number);
                    gpxData += `<trkpt lat="${lat}" lon="${lon}"></trkpt>`;
                });
            });

            gpxData += `</trkseg></trk></gpx>`;
            return gpxData;
        },

        traceCheminEntreFiles() {
            const fileWaypoints = this.fileWaypoints;
            for (let i = 0; i < fileWaypoints.length - 1; i++) {
                const start = fileWaypoints[i].end;
                const end = fileWaypoints[i + 1].start;
            
                if (start && end && start.lat !== undefined && start.lon !== undefined && end.lat !== undefined && end.lon !== undefined) {
                    this.tracerChemin(start, end);
                } else {
                    console.error('Les coordonnées de départ ou d\'arrivée sont invalides:', start, end);
                }
            }
        }
        ,
        tracerChemin(start, end) {
            if (!start || !end || typeof start.lat !== 'number' || typeof start.lon !== 'number' || typeof end.lat !== 'number' || typeof end.lon !== 'number') {
                console.error('Les coordonnées de départ ou d\'arrivée sont invalides:', start, end);
                return;
            }

            const [startLat, startLon] = [start.lat, start.lon];
            const [endLat, endLon] = [end.lat, end.lon];

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
                    routeLayer.selected = false;
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

        decouperChemin() {
            const selectedLayer = this.routeLayers.find(layer => layer.selected);
            if (!selectedLayer) {
                alert('Veuillez sélectionner un chemin à découper.');
                return;
            }

            const numParts = this.numParts;
            if (numParts < 1) {
                alert('Veuillez entrer un nombre valide de parties.');
                return;
            }

            fetch(selectedLayer.gpxData)
                .then(response => response.text())
                .then(data => {
                    const parser = new DOMParser();
                    const gpxDoc = parser.parseFromString(data, "application/xml");
                    const trackPoints = gpxDoc.querySelectorAll('trkpt');
                    const totalPoints = trackPoints.length;

                    if (totalPoints < numParts) {
                        alert('Le nombre de parties est supérieur au nombre de points dans le chemin.');
                        return;
                    }

                    const pointsPerPart = Math.floor(totalPoints / numParts);
                    let currentPart = 0;
                    let newTrackSegments = [];

                    for (let i = 0; i < totalPoints; i++) {
                        if (i % pointsPerPart === 0 && currentPart < numParts) {
                            if (currentPart > 0) {
                                newTrackSegments[currentPart - 1].appendChild(trackPoints[i].cloneNode(true));
                            }
                            currentPart++;
                            newTrackSegments[currentPart - 1] = gpxDoc.createElement('trkseg');
                        }
                        newTrackSegments[currentPart - 1].appendChild(trackPoints[i].cloneNode(true));
                    }

                    newTrackSegments.forEach((segment, index) => {
                        const newGpxDoc = gpxDoc.cloneNode(false);
                        const newTrack = gpxDoc.createElement('trk');
                        newTrack.appendChild(segment);
                        newGpxDoc.appendChild(newTrack);

                        const serializer = new XMLSerializer();
                        const gpxString = serializer.serializeToString(newGpxDoc);
                        const blob = new Blob([gpxString], { type: 'application/gpx+xml' });
                        const url = URL.createObjectURL(blob);

                        const routeLayer = new L.GPX(url, {
                            async: true,
                            marker_options: {
                                startIconUrl: 'https://leafletjs.com/examples/custom-icons/leaf-green.png',
                                endIconUrl: 'https://leafletjs.com/examples/custom-icons/leaf-red.png',
                                shadowUrl: 'https://leafletjs.com/examples/custom-icons/leaf-shadow.png'
                            },
                            polyline_options: {
                                color: this.colors[this.routeLayers.length % this.colors.length]
                            }
                        }).on('loaded', e => {
                            this.map.fitBounds(e.target.getBounds());
                        }).addTo(this.map);

                        routeLayer.selected = false; // Initialement non sélectionné
                        routeLayer.gpxData = url; // Stocker l'URL du fichier GPX pour l'exportation
                        this.routeLayers.push(routeLayer);
                    });
                })
            .catch(error => console.error('Erreur lors de la récupération ou du traitement des données GPX:', error));
        }
    }
});