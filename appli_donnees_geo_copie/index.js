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
        },
        transportType: 0, // Type de transport initialisé à 0 (véhicule motorisé)
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
        async trouverChemin() {
            try {
                const startLocationData = await this.fetchLocation(this.startLocation);
                if (!startLocationData) {
                    alert("Lieu de départ non trouvé");
                    return;
                }

                const endLocationData = await this.fetchLocation(this.endLocation);
                if (!endLocationData) {
                    alert("Lieu d'arrivée non trouvé");
                    return;
                }

                const { lat: startLat, lon: startLon } = startLocationData;
                const { lat: endLat, lon: endLon } = endLocationData;

                const gpxData = await this.fetchGpxData(startLat, startLon, endLat, endLon);

                if (this.routeLayer) {
                    this.map.removeLayer(this.routeLayer);
                }

                this.routeLayer = new L.GPX(gpxData, { async: true })
                    .on('loaded', (e) => {
                        this.map.fitBounds(e.target.getBounds());
                    })
                    .addTo(this.map);
            } catch (error) {
                console.error('Erreur lors de l\'appel à l\'API ou du chargement du GPX:', error);
            }
        },
        fetchLocation(location) {
            return fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${location}`)
                .then(response => response.json())
                .then(data => data && data.length > 0 ? data[0] : null)
                .catch(error => {
                    console.error('Erreur lors de la recherche du lieu:', error);
                    return null;
                });
        },
        fetchGpxData(startLat, startLon, endLat, endLon) {
            const url = `http://127.0.0.1:8000/api/?lat1=${startLat}&lon1=${startLon}&lat2=${endLat}&lon2=${endLon}&type=${this.transportType}`;
            return fetch(url)
                .then(response => response.text())
                .catch(error => {
                    console.error('Erreur lors de la récupération des données GPX:', error);
                    throw error;
                });
        },
        imprimer() {
            window.print();
        },
        exporterCheminGpx(){
            // Fonction pour exporter l'itinéraire au format GPX
            if (this.routeLayer) {
                let gpx = togpx(this.routeLayer.toGeoJSON());
                this.downloadFile(gpx, 'route.gpx', 'application/gpx+xml');
            } else {
                alert('Aucun chemin à exporter');
            }
        },
        exporterCheminKml() {
            // Fonction pour exporter l'itinéraire au format KML
            if (this.routeLayer) {
                let kml = tokml(this.routeLayer.toGeoJSON());
                this.downloadFile(kml, 'route.kml', 'application/vnd.google-earth.kml+xml');
            } else {
                alert('Aucun chemin à exporter');
            }
        },
        chargerFichierCarte(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (this.fileLayer) {
                        this.map.removeLayer(this.fileLayer);
                    }
                    this.fileLayer = L.geoJSON(JSON.parse(e.target.result)).addTo(this.map);
                };
                reader.readAsText(file);
            }
        },
        downloadFile(content, filename, contentType) {
            let a = document.createElement('a');
            let blob = new Blob([content], { type: contentType });
            let url = URL.createObjectURL(blob);
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
        }

    }
    
});

/*window.addEventListener("load", () => {
	let a = document.getElementById("location-input");

	a.addEventListener("keydown", (e) => {
		if(e.key === "Enter")
		{
			app.chercher();
		}
	});
});
*/

