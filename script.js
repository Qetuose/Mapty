'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const sortType = document.querySelector('.sort--select');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const buttonReset = document.querySelector('.button-reset');
const inputError = document.querySelector('.form--error');
const checkBox = document.querySelector('.checkbox');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #apiKey = `bdc_a03f3cfed2234d4b843fba1270978e36`;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);
    sortType.addEventListener('change', this._sortWorkouts.bind(this));
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click',this._showWorkoutButtons.bind(this)); //prettier-ignore
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    containerWorkouts.addEventListener('click', this._renderEditForm.bind(this)); //prettier-ignore
    containerWorkouts.addEventListener('click', this._cacncelEdit.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    buttonReset.addEventListener('click', this.reset);
    checkBox.addEventListener('change', this._handleCheckbox);
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    const shakeAnimation = [
      { transform: `translate(0,0)`, offset: 0 },
      { transform: `translate(5px,0)`, offset: 0.017 },
      { transform: `translate(0,0)`, offset: 0.035 },
      { transform: `translate(5px,0)`, offset: 0.053 },
      { transform: `translate(0,0)`, offset: 0.071 },
      { transform: `translate(5px,0)`, offset: 0.089 },
      { transform: `translate(0,0)`, offset: 0.1 },
      { transform: `translate(0,0)`, offset: 1 },
    ];

    const animationTiming = {
      duration: 4720,
      iterations: 1,
    };

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        form.animate(shakeAnimation, animationTiming);
        inputError.classList.remove('hidden');
        return;
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        form.animate(shakeAnimation, animationTiming);
        inputError.classList.remove('hidden');
        return;
      }

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const [lat, lng] = workout.coords;

    this._getCity(lat, lng).then(res => {
      L.marker(workout.coords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
          })
        )
        .setPopupContent(
          `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${
            workout.description
          } in ${res}`
        )
        .openPopup();
    });
  }

  _renderWorkout(workout) {
    const [lat, lng] = workout.coords;

    this._getCity(lat, lng).then(res => {
      let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <div class= "workout--wrapper">
        <h2 class="workout__title">${workout.description}, ${res}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

      if (workout.type === 'running')
        html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      `;

      if (workout.type === 'cycling')
        html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">📈</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      `;

      html += `
    </div>
        <div class = "workout--button-container">
          <button class="workout--button workout--button-edit">Edit</button>
          <button class="workout--button workout--button-delete">Delete</button>
        </div>
      </li>
      `;

      form.insertAdjacentHTML('afterend', html);
      this._hideWorkoutButtons();
    });
  }

  _deleteWorkout(e) {
    if (e.target.classList.contains('workout--button-delete')) {
      const workoutEl = e.target.closest('.workout');
      if (!workoutEl) return;

      const workout = this.#workouts.find(
        work => work.id === workoutEl.dataset.id
      );

      this.#workouts = this.#workouts.filter(work => work !== workout);

      localStorage.removeItem('workouts');
      this._setLocalStorage();

      location.reload();
    }
  }

  _renderEditForm(e) {
    if (e.target.classList.contains('workout--button-edit')) {
      const workoutEl = e.target.closest('.workout');
      if (!workoutEl) return;

      const workout = this.#workouts.find(
        work => work.id === workoutEl.dataset.id
      );

      workoutEl.classList.add('hidden');

      let html = `
         <li class="workout workout--${workout.type}" data-id="${workout.id}"> 
        <form>
       <div class= "workout--wrapper">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <input class="edit--input value-distance" value="${
            workout.distance
          }"></input>
          <span class="workout__unit ">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <input class="edit--input value-duration" value="${
            workout.duration
          }"></input>
          <span class="workout__unit">min</span>
        </div>
    `;

      if (workout.type === 'running')
        html += `
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <input class="edit--input value-cadence" value="${workout.cadence}"></input>
          <span class="workout__unit">spm</span>
        </div>
      `;

      if (workout.type === 'cycling')
        html += `
        <div class="workout__details">
          <span class="workout__icon">📈</span>
          <input class="edit--input value-elevationGain" value="${workout.elevationGain}"></input>
          <span class="workout__unit">m</span>
        </div>
       
      `;

      html += `
      <div class="editContainer">
        <button type="submit" class="workout--button button-save">Save</button>
        <button class="workout--button button-cancel">Cancel</button>
      </div>
       </form>
        </li>
      `;

      form.insertAdjacentHTML('afterend', html);
    }
  }

  _editWorkout(e) {
    if (e.target.classList.contains('button-save')) {
      const distance = document.querySelector('.value-distance').value;
      const duration = document.querySelector('.value-duration').value;
      let cadence;
      let elevationGain;

      if (!this.#map) return;

      const workoutEl = e.target.closest('.workout');

      if (!workoutEl) return;

      const index = this.#workouts.findIndex(
        work => work.id === workoutEl.dataset.id
      );

      this.#workouts[index].distance = +distance;
      this.#workouts[index].duration = +duration;

      if (this.#workouts[index].type === 'running') {
        cadence = document.querySelector('.value-cadence').value;
        this.#workouts[index].cadence = +cadence;
      }

      if (this.#workouts[index].type === 'cycling') {
        elevationGain = document.querySelector('.value-elevationGain').value;
        this.#workouts[index].elevationGain = +elevationGain;
      }

      localStorage.removeItem('workouts');

      this._setLocalStorage();
      location.reload();
    }
  }

  _cacncelEdit(e) {
    if (e.target.classList.contains('button-cancel')) {
      const workoutEl = e.target.closest('.workout');
      if (!workoutEl) return;

      workoutEl.remove();
      containerWorkouts
        .querySelector('.workout.hidden')
        .classList.remove('hidden');
    }
  }

  _hideWorkoutButtons() {
    const btns = document.querySelectorAll('.workout--button-container');
    btns.forEach(el => el.classList.add('hidden'));
  }

  _showWorkoutButtons(e) {
    const clicked = e.target.closest('.workout--wrapper');
    if (!clicked) return;

    const btnContainer = clicked
      .closest('.workout')
      .querySelector('.workout--button-container');

    if (!btnContainer) return;

    if (btnContainer.classList.contains('hidden')) {
      this._hideWorkoutButtons();
      btnContainer.classList.remove('hidden');
    } else btnContainer.classList.add('hidden');
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      if (work.type === 'running')
        this._renderWorkout(Object.assign(work, Running));

      if (work.type === 'cycling')
        this._renderWorkout(Object.assign(work, Cycling));
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _sortWorkouts(MapE) {
    const workoutEls = containerWorkouts.querySelectorAll('.workout');
    workoutEls.forEach(el => el.remove());
    let workoutsArr = [];

    if (sortType.value === 'none')
      this.#workouts.forEach(workout => this._renderWorkout(workout));

    if (sortType.value === 'distance') {
      const sortDistnace = this.#workouts.sort(
        (a, b) => a.distance - b.distance
      );
      sortDistnace.forEach(workout => this._renderWorkout(workout));
    }

    if (sortType.value === 'time') {
      const sortDistnace = this.#workouts.sort(
        (a, b) => a.duration - b.duration
      );
      sortDistnace.forEach(workout => this._renderWorkout(workout));
    }
  }

  async _getCity(lat, lng) {
    try {
      const res = await fetch(
        `https://api-bdc.net/data/reverse-geocode?latitude=${lat}&longitude=${lng}&localityLanguage=en&key=${
          this.#apiKey
        }`
      );
      if (!res.ok) throw new Error('Problem Getting location data');

      const data = await res.json();

      return `${data.countryName}, ${data.locality}`;
    } catch (error) {
      console.log(error);
    }
  }

  _handleCheckbox() {
    const popups = document.querySelectorAll('.leaflet-popup');

    popups.forEach(popup => {
      if (this.checked) popup.style.display = 'none';
      else popup.style.display = 'block';
    });
  }
}

const app = new App();
