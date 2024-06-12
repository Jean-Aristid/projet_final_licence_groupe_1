var map = L.map('map').setView([48.8566, 2.3522], 13); // Coordonnées par défaut (Paris)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var marker;
var currentLocation = { name: '', lat: '', lon: '' };

// Fonction pour chercher et afficher un lieu
function chercher() {
    var location = document.getElementById('location-input').value;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${location}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                var lat = data[0].lat;
                var lon = data[0].lon;
                var name = data[0].display_name; // Ajout pour récupérer le nom de la ville
                map.setView([lat, lon], 13);
                if (marker) {
                    map.removeLayer(marker);
                }
                marker = L.marker([lat, lon]).addTo(map)
                    .bindPopup('<b>' + name + '</b>') // Utilisation du nom de la ville dans la popup
                    .openPopup();
                currentLocation = { name: name, lat: lat, lon: lon }; // Stockage du nom de la ville
            } else {
                alert("Lieu non trouvé");
            }
        })
        .catch(error => console.error('Erreur:', error));
}

// Ajouter un événement pour récupérer les coordonnées en cliquant sur la carte
map.on('click', function(e) {
    var lat = e.latlng.lat;
    var lon = e.latlng.lng;
    if (marker) {
        map.removeLayer(marker);
    }
    marker = L.marker([lat, lon]).addTo(map)
        .bindPopup('<b>Coordonnées :</b><br>Latitude: ' + lat + '<br>Longitude: ' + lon)
        .openPopup();
    currentLocation = { name: 'Coordonnées cliquées', lat: lat, lon: lon };
});

// Fonction pour imprimer le nom de la ville et les coordonnées dans un fichier
function imprimer() {
    if (currentLocation.name === '' && currentLocation.lat === '' && currentLocation.lon === '') {
        alert('Aucune information de lieu disponible pour imprimer.');
        return;
    }

    var content = `Nom de la ville : ${currentLocation.name}\nLatitude : ${currentLocation.lat}\nLongitude : ${currentLocation.lon}`;
    var blob = new Blob([content], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'location.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
