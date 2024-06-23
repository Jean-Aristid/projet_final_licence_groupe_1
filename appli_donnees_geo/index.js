var app = new Vue({
    el: '#app',
    data: {
        location: '',
        startLocation: '',
        endLocation: '',
        currentLocation: { name: '', lat: '', lon: '' },
        map: null,
        marker: null,
        routeLayer: null
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
        chargerGPX(event) {
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const gpxData = e.target.result;
                if (this.routeLayer) {
                    this.map.removeLayer(this.routeLayer);
                }
                this.routeLayer = new L.GPX(gpxData, {
                    async: true
                }).on('loaded', (e) => {
                    this.map.fitBounds(e.target.getBounds());
                }).addTo(this.map);
            };
            reader.readAsText(file);
        trouverChemin() {
            //pour départ
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.startLocation}`)
                .then(response => response.json())
                .then(dataStart => {
                    if (dataStart && dataStart.length > 0) {
                        var startLat = dataStart[0].lat;
                        var startLon = dataStart[0].lon;
                        // pour arrivée
                        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${this.endLocation}`)
                            .then(response => response.json())
                            .then(dataEnd => {
                                if (dataEnd && dataEnd.length > 0) {
                                    var endLat = dataEnd[0].lat;
                                    var endLon = dataEnd[0].lon;
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
        }
    }
});

window.addEventListener("load", () => {
	let a = document.getElementById("location-input");
	let c = document.getElementById("fichier");

	a.addEventListener("keydown", (e) => {
		if(e.key === "Enter")
		{
			app.chercher();
		}
	});
	
	c.addEventListener("click", (e) => {
		app.chargerGPX(e);
	});
})


