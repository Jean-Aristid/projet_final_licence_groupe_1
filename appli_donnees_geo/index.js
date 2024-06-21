var app = new Vue({
    el: '#app',
    data: {
        location: '',
        startLocation: '',
        endLocation: '',
        currentLocation: { name: '', lat: '', lon: '' },
        map: null,
        marker: null,
        start_marker: null,
        end_marker: null,
        routeLayer: null,
        polyline: null,
        start_coordinates: { name: '', lat: '', lon: '' },
        end_coordinates: { name: '', lat: '', lon: '' }, 
        coordinates: [],
        afficherTransport: false, 
        fileLayer: null,
        marker_options: {
            startIconUrl: 'https://www.mapbox.com/help/demos/custom-markers-gl-js/start.png',
            endIconUrl: 'https://www.mapbox.com/help/demos/custom-markers-gl-js/end.png',
            shadowUrl: ''
        }
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
            this.map = L.map('map').setView([48.8566, 2.3522], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            this.map.on('click', this.on_map_click);
        },
        chercher() {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.location}`)
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
                            .bindPopup('<b>' + name + '</b>'
                            + '<br>' + '<b> latitude : ' + lat + '</b>'
                            + '<br>' + '<b> longitude : ' + lon + '</b>'
                            )
                            .openPopup();
                        this.currentLocation = { name: name, lat: lat, lon: lon };
                    } else {
                        alert("Lieu non trouvé");
                    }
                })
                .catch(error => console.error('Erreur:', error));
        },
        on_map_click(e) {
            var lat = e.latlng.lat;
            var lon = e.latlng.lng;
            if (this.marker) {
                this.map.removeLayer(this.marker);
            }
            this.marker = L.marker([lat, lon]).addTo(this.map)
                .bindPopup('<b>Coordonnées :</b><br>Latitude: ' + lat + '<br>Longitude: ' + lon)
                .openPopup();
            this.currentLocation = { name: 'Coordonnées cliquées', lat: lat, lon: lon };
        },
        handleShortcut(event) {
            if (event.ctrlKey && event.key === 'a') {
                event.preventDefault();
                this.$refs.locationInput.focus();

            }
        },
        imprimer() {
            if (this.currentLocation.name === '' && this.currentLocation.lat === '' && this.currentLocation.lon === '') {
                alert('Aucune information de lieu disponible pour imprimer.');
                return;
            }

            var content = `Nom de la ville : ${this.currentLocation.name}\nLatitude : ${this.currentLocation.lat}\nLongitude : ${this.currentLocation.lon}`;
            var blob = new Blob([content], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'location_' + this.currentLocation.name + '.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        afficherChoixTransport() {
            this.afficherTransport = !this.afficherTransport;
        }, 
        /** 
        trouverChemin() {
            //pour départ
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.startLocation}`)
                .then(response => response.json())
                .then(dataStart => {
                    if (dataStart && dataStart.length > 0) {
                        var startLat = dataStart[0].lat;
                        var startLon = dataStart[0].lon;
                        var start_name = dataStart[0].display_name;
                        this.map.setView([startLat, startLon], 13);
                        if (this.start_marker) {
                            this.map.removeLayer(this.start_marker);
                        }
                        this.start_marker = L.marker([startLat, startLon]).addTo(this.map)
                            .bindPopup('<b>' + start_name + '</b>'
                            + '<br>' + '<b> latitude : ' + startLat + '</b>'
                            + '<br>' + '<b> longitude : ' + startLon + '</b>'
                            )
                            .openPopup();
                       this.start_coordinates = { name: start_name, lat: startLat, lon: startLon };
                        // pour arrivée
                        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.endLocation}`)
                            .then(response => response.json())
                            .then(dataEnd => {
                                if (dataEnd && dataEnd.length > 0) {
                                    var endLat = dataEnd[0].lat;
                                    var endLon = dataEnd[0].lon;
                                    var end_name = dataEnd[0].display_name;
                                    this.map.setView([endLat, endLon], 13);
                                    if (this.end_marker) {
                                        this.map.removeLayer(this.end_marker);
                                    }
                                    this.end_marker = L.marker([endLat, endLon]).addTo(this.map)
                                        .bindPopup('<b>' + end_name + '</b>'
                                        + '<br>' + '<b> latitude : ' + endLat + '</b>'
                                        + '<br>' + '<b> longitude : ' + endLon + '</b>'
                                        )
                                        .openPopup();
                                    this.end_coordinates = { name: end_name, lat: endLat, lon: endLon };
                                    // Requête chemins
                                    fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`)
                                        .then(response => response.json())
                                        .then(routeData => {
                                            if (routeData && routeData.routes && routeData.routes.length > 0) {
                                                var route = routeData.routes[0].geometry;
                                                if (this.routeLayer) {
                                                    this.map.removeLayer(this.routeLayer);
                                                }
                                                this.routeLayer = L.geoJSON(route).addTo(this.map);
                                                this.coordinates = route.coordinates;
                                                this.animerChemin(route.coordinates);
                                            } else {
                                                alert("Chemin non trouvé");
                                            }
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
        }*/
        trouverChemin(modeTransport) {
            if (!this.startLocation || !this.endLocation) {
                alert("Veuillez entrer un lieu de départ et un lieu d'arrivée.");
                return;
            }

            // Convertir le mode de transport en paramètre pour l'API OSRM
            let profile;
            switch (modeTransport) {
                case 'voiture':
                    profile = 'driving-car'; // Utiliser 'driving-car' pour la voiture
                    break;
                case 'moto':
                    profile = 'driving-motorcycle'; // Utiliser 'driving-motorcycle' pour la moto
                    break;
                case 'velo':
                    profile = 'cycling'; // Utiliser 'cycling' pour le vélo
                    break;
                case 'pied':
                    profile = 'walking'; // Utiliser 'walking' pour la marche
                    break;
                default:
                    profile = 'driving-car'; // Par défaut, utiliser 'driving-car' (voiture)
            }

            // Requête pour le lieu de départ
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.startLocation}`)
                .then(response => response.json())
                .then(dataStart => {
                    if (dataStart && dataStart.length > 0) {
                        var startLat = dataStart[0].lat;
                        var startLon = dataStart[0].lon;
                        var start_name = dataStart[0].display_name;
                        this.map.setView([startLat, startLon], 13);
                        if (this.start_marker) {
                            this.map.removeLayer(this.start_marker);
                        }
                        this.start_marker = L.marker([startLat, startLon]).addTo(this.map)
                            .bindPopup('<b>' + start_name + '</b>'
                                + '<br>' + '<b> latitude : ' + startLat + '</b>'
                                + '<br>' + '<b> longitude : ' + startLon + '</b>'
                            )
                            .openPopup();
                        this.start_coordinates = { name: start_name, lat: startLat, lon: startLon };

                        // Requête pour le lieu d'arrivée
                        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.endLocation}`)
                            .then(response => response.json())
                            .then(dataEnd => {
                                if (dataEnd && dataEnd.length > 0) {
                                    var endLat = dataEnd[0].lat;
                                    var endLon = dataEnd[0].lon;
                                    var end_name = dataEnd[0].display_name;
                                    this.map.setView([endLat, endLon], 13);
                                    if (this.end_marker) {
                                        this.map.removeLayer(this.end_marker);
                                    }
                                    this.end_marker = L.marker([endLat, endLon]).addTo(this.map)
                                        .bindPopup('<b>' + end_name + '</b>'
                                            + '<br>' + '<b> latitude : ' + endLat + '</b>'
                                            + '<br>' + '<b> longitude : ' + endLon + '</b>'
                                        )
                                        .openPopup();
                                    this.end_coordinates = { name: end_name, lat: endLat, lon: endLon };

                                    // Requête pour le chemin avec le mode de transport spécifié
                                    fetch(`https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}?overview=full&steps=true&geometries=geojson`)
                                        .then(response => response.json())
                                        .then(routeData => {
                                            if (routeData && routeData.routes && routeData.routes.length > 0) {
                                                var route = routeData.routes[0].geometry;
                                                var instructions = routeData.routes[0].legs[0].steps;
                                                if (this.routeLayer) {
                                                    this.map.removeLayer(this.routeLayer);
                                                }
                                                this.routeLayer = L.geoJSON(route).addTo(this.map);
                                                this.coordinates = route.coordinates;
                                                this.animerChemin(route.coordinates);
                                            } else {
                                                alert("Chemin non trouvé pour le mode de transport sélectionné.");
                                            }
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

            if(this.polyline){
                this.map.removeLayer(this.polyline) ; 
            }

            this.polyline = polyline ; 
            const addPoint = () => {
                if (index < coordinates.length) {
                    polyline.addLatLng([coordinates[index][1], coordinates[index][0]]);
                    index++;
                    setTimeout(addPoint, 20); // vitesse
                }
            };
            addPoint();
        }, 

        exporterCheminGpx(){
            if (this.coordinates.length === 0) {
                alert("Pas de coordonnées pour exporter");
                return;
            }
            const nom_fichier = prompt("donner_un_nom_à_votre_fichier :") ; 

            if(nom_fichier === '' || nom_fichier === undefined || nom_fichier === null){
                alert("donner un nom au fichier") ;
            }else{
                const gpxContent = this.generateGPXContent(this.coordinates, this.start_coordinates, this.end_coordinates);
                this.downloadGPX(gpxContent,  nom_fichier+'.gpx');
            }
        },

        generateGPXContent(coordinates, start_coordinates,end_coordinates) {
            let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" creator="YourAppName" xmlns="http://www.topografix.com/GPX/1/1">
                <trk>
                    <name> Itinéraire au format GPX 
                       de  ${start_coordinates.name} 
                       à   ${end_coordinates.name}
                    </name>
                    <trkseg>`;

                    if (start_coordinates) {
                        gpxContent += `
                        <trkpt lat="${start_coordinates.lat}" lon="${start_coordinates.lon}">
                            <ele>${start_coordinates.name}</ele>
                        </trkpt>`;
                    }

                    coordinates.forEach(coord => {
                        gpxContent += `
                        <trkpt lat="${coord[1]}" lon="${coord[0]}">
                            <ele>Point</ele>
                        </trkpt>`;
                    });

                    if (end_coordinates) {
                        gpxContent += `
                        <trkpt lat="${end_coordinates.lat}" lon="${end_coordinates.lon}">
                            <ele>${end_coordinates.name}</ele>
                        </trkpt>`;
                    }

                gpxContent += `
                    </trkseg>
                </trk>
            </gpx>`;

            return gpxContent;
        },

        downloadGPX(content, filename) {
            const blob = new Blob([content], { type: 'application/gpx+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        exporterCheminKml(){
            if (this.coordinates.length === 0) {
                alert("Pas de coordonnées pour exporter");
                return;
            }
            const nom_fichier = prompt("donner_un_nom_à_votre_fichier :") ; 

            if(nom_fichier === '' || nom_fichier === undefined || nom_fichier === null){
                alert("donner un nom au fichier") ;
            }else{
                const gpxContent = this.generateKMLContent(this.coordinates, this.start_coordinates, this.end_coordinates);
                this.downloadKML(gpxContent,  nom_fichier+'.kml');
            }
        },

        generateKMLContent(coordinates, start_coordinates, end_coordinates) {
            let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
            <kml xmlns="http://www.opengis.net/kml/2.2">
                <Document>
                    <name>Itinéraire au format KML </name>
                    <description> Itinéraire 
                                  de ${start_coordinates.name} 
                                  à ${end_coordinates.name}
                    </description>
                    <Placemark>
                        <name> Itinéraire 
                               de ${start_coordinates.name} 
                               à ${end_coordinates.name}
                        </name>
                        <description> Itinéraire 
                                      de ${start_coordinates.name} 
                                      à ${end_coordinates.name}</description>
                        <LineString>
                            <coordinates>`;
            
                                    // On ajoute  le point de départ
                                    kmlContent += `${start_coordinates.lon},${start_coordinates.lat},0\n`;

                                    // On ajoute les coordonnées du chemin
                                    coordinates.forEach(coord => {
                                        kmlContent += `${coord[0]},${coord[1]},0\n`;
                                    });

                                    // Ajouter le point d'arrivée
                                    kmlContent += `${end_coordinates.lon},${end_coordinates.lat},0\n`;

            kmlContent += `</coordinates>
                        </LineString>
                    </Placemark>
                </Document>
            </kml>`;

            return kmlContent;
        }, 

        downloadKML(content, filename) {
            const blob = new Blob([content], {type: 'application/vnd.google-earth.kml+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        chargerFichierCarte(event) {
            const file = event.target.files[0];
            if (!file) {
                alert('Aucun fichier sélectionné');
                return;
            }
    
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileContent = e.target.result;
    
                if (file.name.endsWith('.gpx')) {
                    this.chargerGPX(fileContent);
                } else if (file.name.endsWith('.kml')) {
                    this.chargerKML(fileContent);
                } else {
                    alert('Format de fichier non supporté. Veuillez charger un fichier GPX ou KML.');
                }
            };
            reader.readAsText(file);
        },
        /* version 1 
        chargerGPX(gpxData) {
            if (this.fileLayer) {
                this.map.removeLayer(this.fileLayer);
            }
            this.fileLayer = new L.GPX(gpxData, {
                async: true,
            }).on('loaded', (e) => {
                const gpx = e.target;
                this.map.fitBounds(gpx.getBounds());

                const start = gpx.getStartMarker().getLatLng();
                const end = gpx.getEndMarker().getLatLng();

                this.addMarker(start, 'Départ');
                this.addMarker(end, 'Arrivée');
            }).addTo(this.map);
        },
        chargerKML(kmlData) {
            if (this.fileLayer) {
                this.map.removeLayer(this.fileLayer);
            }
            this.fileLayer = omnivore.kml.parse(kmlData);
            this.fileLayer.on('ready', () => {
                this.map.fitBounds(this.fileLayer.getBounds());

                const coordinates = this.fileLayer.getLayers()[0].feature.geometry.coordinates;
                const start = [coordinates[0][1], coordinates[0][0]];
                const end = [coordinates[coordinates.length - 1][1], coordinates[coordinates.length - 1][0]];

                this.addMarker(start, 'Départ');
                this.addMarker(end, 'Arrivée');
            }).addTo(this.map);
        },
        addMarker(latlng, label) {
            const marker = L.marker(latlng).addTo(this.map)
                .bindPopup(`<b>${label}</b><br>Latitude: ${latlng[0]}<br>Longitude: ${latlng[1]}`)
                .openPopup();
            
            if (label === 'Départ') {
                if (this.start_marker) {
                    this.map.removeLayer(this.start_marker);
                }
                this.start_marker = marker;
            } else if (label === 'Arrivée') {
                if (this.end_marker) {
                    this.map.removeLayer(this.end_marker);
                }
                this.end_marker = marker;
            }
        }*/

        /* version 2 
        chargerGPX(gpxData) {
            if (this.fileLayer) {
                this.map.removeLayer(this.fileLayer);
            }
            this.fileLayer = new L.GPX(gpxData, {
                async: true,
            }).on('loaded', (e) => {
                const gpx = e.target;
                this.map.fitBounds(gpx.getBounds());

                const start = gpx.getStartMarker().getLatLng();
                const end = gpx.getEndMarker().getLatLng();

                this.addMarker(start, 'Départ', this.marker_options.startIconUrl);
                this.addMarker(end, 'Arrivée', this.marker_options.endIconUrl);
            }).addTo(this.map);
        },
        chargerKML(kmlData) {
            if (this.fileLayer) {
                this.map.removeLayer(this.fileLayer);
            }
            this.fileLayer = omnivore.kml.parse(kmlData);
            this.fileLayer.on('ready', () => {
                this.map.fitBounds(this.fileLayer.getBounds());

                const coordinates = this.fileLayer.getLayers()[0].feature.geometry.coordinates;
                const start = [coordinates[0][1], coordinates[0][0]];
                const end = [coordinates[coordinates.length - 1][1], coordinates[coordinates.length - 1][0]];

                this.addMarker(start, 'Départ', this.marker_options.startIconUrl);
                this.addMarker(end, 'Arrivée', this.marker_options.endIconUrl);
            }).addTo(this.map);
        },
        addMarker(latlng, label, iconUrl) {
            const markerIcon = L.icon({
                iconUrl: iconUrl,
                shadowUrl: this.marker_options.shadowUrl,
                iconSize: [25, 41], // taille de l'icône
                iconAnchor: [12, 41], // point de l'icône qui correspondra à la position du marqueur
                popupAnchor: [1, -34], // point depuis lequel la popup doit s'ouvrir par rapport à l'iconAnchor
                shadowSize: [41, 41] // taille de l'ombre
            });

            
            const marker = L.marker(latlng, { icon: markerIcon }).addTo(this.map)
                .bindPopup(`<b>${label}</b><br>Latitude: ${latlng[0]}<br>Longitude: ${latlng[1]}`)
                .openPopup();
            
            if (label === 'Départ') {
                if (this.start_marker) {
                    this.map.removeLayer(this.start_marker);
                }
                this.start_marker = marker;
            } else if (label === 'Arrivée') {
                if (this.end_marker) {
                    this.map.removeLayer(this.end_marker);
                }
                this.end_marker = marker;
            }
        }
        */ 

    }
    
});

window.addEventListener("load", () => {
	let a = document.getElementById("location-input");

	a.addEventListener("keydown", (e) => {
		if(e.key === "Enter")
		{
			app.chercher();
		}
	});
})


