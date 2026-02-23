import { fetchMonthCalendar } from './prayer-times.js';
import { getCity, getCountry, getCalculationMethod, getMethodAngles, getUserCoords } from './settings.js';

let currentViewDate = new Date();
let calendarInitialized = false;

export async function initCalendar() {
    if (calendarInitialized) return;
    calendarInitialized = true;

    const prevBtn = document.getElementById('hnav-prev');
    const nextBtn = document.getElementById('hnav-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentViewDate.setMonth(currentViewDate.getMonth() - 1);
            renderCalendar(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentViewDate.setMonth(currentViewDate.getMonth() + 1);
            renderCalendar(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1);
        });
    }

    // Initial load
    await renderCalendar(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1);
}

export async function refreshCalendar() {
    if (!calendarInitialized) return;
    await renderCalendar(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1);
}

async function renderCalendar(year, month) {
    const tBody = document.getElementById('calendar-body');
    const loading = document.getElementById('calendar-loading');
    const monthName = document.getElementById('horaires-month-name');
    const hnavCurrent = document.getElementById('hnav-current');

    if (!tBody || !loading) return;

    // Format month/year
    const dateObj = new Date(year, month - 1, 1);
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
    const monthStr = formatter.format(dateObj);
    const capitalized = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

    if (monthName) monthName.textContent = capitalized;
    if (hnavCurrent) hnavCurrent.textContent = capitalized;

    tBody.innerHTML = '';
    loading.classList.remove('hidden');

    const method = getCalculationMethod();
    const angles = getMethodAngles();
    const coords = getUserCoords();
    const locationParams = {
        lat: coords?.lat,
        lon: coords?.lon,
        city: getCity(),
        country: getCountry(),
        method,
        angles,
    };

    const calendarData = await fetchMonthCalendar(year, month, locationParams);

    loading.classList.add('hidden');

    if (!calendarData || !Array.isArray(calendarData)) {
        tBody.innerHTML = `<tr><td colspan="7" style="color: var(--clr-gold); padding: 20px;">Erreur lors du chargement des horaires.</td></tr>`;
        return;
    }

    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    calendarData.forEach(day => {
        const tr = document.createElement('tr');

        // Aladhan returns date as DD-MM-YYYY in day.date.gregorian.date
        const dateText = day.date.gregorian.date;
        const isToday = dateText === todayStr;

        if (isToday) {
            tr.classList.add('today-row');
        }

        // Format prayer times (removing timezone string if present, e.g. "05:30 (CET)" -> "05:30")
        const cleanTime = (timeStr) => timeStr ? timeStr.split(' ')[0] : '--:--';

        const tdDate = document.createElement('td');
        // Display short date format (e.g. 1 Mars)
        const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
        const dayDateObj = new Date(year, month - 1, parseInt(day.date.gregorian.day));
        tdDate.textContent = dayFormatter.format(dayDateObj);

        const tdFajr = document.createElement('td');
        tdFajr.textContent = cleanTime(day.timings.Fajr);

        const tdSunrise = document.createElement('td');
        tdSunrise.textContent = cleanTime(day.timings.Sunrise);

        const tdDhuhr = document.createElement('td');
        tdDhuhr.textContent = cleanTime(day.timings.Dhuhr);

        const tdAsr = document.createElement('td');
        tdAsr.textContent = cleanTime(day.timings.Asr);

        const tdMaghrib = document.createElement('td');
        tdMaghrib.textContent = cleanTime(day.timings.Maghrib);

        const tdIsha = document.createElement('td');
        tdIsha.textContent = cleanTime(day.timings.Isha);

        tr.appendChild(tdDate);
        tr.appendChild(tdFajr);
        tr.appendChild(tdSunrise);
        tr.appendChild(tdDhuhr);
        tr.appendChild(tdAsr);
        tr.appendChild(tdMaghrib);
        tr.appendChild(tdIsha);

        tBody.appendChild(tr);
    });
}
