var app = new Vue({
    el: '#app',
    data: {
        startLocation: '',
        endLocation: '',
        startSuggestions: [],
        endSuggestions: [],
        transportType: 0, // Type de transport initialisé à 0 (véhicule motorisé)
        currentLocation: { name: '', lat: '', lon: '' },
        map: null,
        marker: null,
        routeLayers: [], // Tableau pour stocker les différentes couches de chemin
        waypoints: []
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

            // Essayer de centrer sur la localisation actuelle de l'utilisateur
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
            var lat = e.latlng.lat;
            var lon = e.latlng.lng;

            this.waypoints.push([lat, lon]);

            if (this.marker) {
                this.map.removeLayer(this.marker);
            }

            this.marker = L.marker([lat, lon]).addTo(this.map)
                .bindPopup('<b>Coordonnées :</b><br>Latitude: ' + lat + '<br>Longitude: ' + lon)
                .openPopup();

            if (this.waypoints.length > 1) {
                const lastIndex = this.waypoints.length - 1;
                this.startLocation = `${this.waypoints[lastIndex - 1][0]},${this.waypoints[lastIndex - 1][1]}`;
                this.endLocation = `${this.waypoints[lastIndex][0]},${this.waypoints[lastIndex][1]}`;
                this.trouverChemin();
            }

            this.currentLocation = { name: 'Coordonnées cliquées', lat: lat, lon: lon };
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
                                            this.routeLayers.push(routeLayer); // Ajouter la nouvelle couche de chemin au tableau
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

            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const gpxData = e.target.result;
                    const routeLayer = new L.GPX(gpxData, {
                        async: true
                    }).on('loaded', (e) => {
                        this.map.fitBounds(e.target.getBounds());
                    }).addTo(this.map);
                    this.routeLayers.push(routeLayer); // Ajouter la nouvelle couche de chemin au tableau
                };
                reader.readAsText(file);
            });
        },
        selectTransportType(type) {
            this.transportType = type;
        },
        handleShortcut(event) {
            if (event.ctrlKey && event.key === 'a') {
                event.preventDefault();
                this.$refs.endLocation.focus();
            }

            if (event.ctrlKey && event.key === 'z') {
                event.preventDefault();
                this.$refs.startLocation.focus();
            }
        }
    }
});
