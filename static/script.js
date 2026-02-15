let barChart;
let lineChart;

/* ── dark to light mode ─────────────────────────────────────────── */
function myFunction() {
    var element = document.body;
    element.classList.toggle("dark-mode");
  }

/* ── Build shared query-string from current filter values ────── */
function buildQueryParams() {
    const vendor   = document.getElementById("vendor").value;
    const minPrice = document.getElementById("min_price").value;
    const maxPrice = document.getElementById("max_price").value;
    const fromZone = document.getElementById("from-zone").value;
    const toZone   = document.getElementById("to-zone").value;

    const params = new URLSearchParams();
    if (vendor)   params.append("vendor",    vendor);
    if (minPrice) params.append("min_price", minPrice);
    if (maxPrice) params.append("max_price", maxPrice);
    if (fromZone) params.append("from_zone", fromZone);   // fixed: was appending to "vendor"
    if (toZone)   params.append("to_zone",   toZone);     // fixed: was typo "vwndor" + wrong value

    return params.toString();
}

/* ── Main filter handler — called by button AND on page load ─── */
function applyFilters() {   // fixed: was named mismatch (HTML called search(), JS had applyFilters())
    const qs = buildQueryParams();

    setTableLoading(true);

    // Fetch both endpoints in parallel
    Promise.all([
        fetch(`/analytics/price-summary?${qs}`).then(r => r.json()),
        fetch(`/analytics/trips?${qs}&limit=100`).then(r => r.json())
    ])
    .then(([summaryData, tripsData]) => {
        updateCharts(summaryData);
        updateTable(tripsData);
    })
    .catch(err => {
        console.error("Fetch error:", err);
        setTableLoading(false, "Error loading data. Check console.");
    });
}

/* ── Trips Table ─────────────────────────────────────────────── */
function setTableLoading(loading, msg) {
    const status = document.getElementById("table-status");
    const table  = document.getElementById("trips-table");
    if (loading) {
        status.textContent = msg || "Loading trips…";
        status.style.display = "block";
        table.style.display  = "none";
    } else {
        status.style.display = msg ? "block" : "none";
        if (msg) status.textContent = msg;
        table.style.display  = msg ? "none" : "table";
    }
}

function updateTable(data) {
    const tbody = document.querySelector("#trips-table tbody");
    tbody.innerHTML = "";

    if (!data || data.length === 0) {
        setTableLoading(false, "No trips found for the selected filters.");
        return;
    }

    setTableLoading(false);

    data.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><span class="vendor-badge vendor-${item.VendorID}">V${item.VendorID}</span></td>
            <td>${formatDateTime(item.tpep_pickup_datetime)}</td>
            <td>${formatDateTime(item.tpep_dropoff_datetime)}</td>
            <td>${item.PULocationID}</td>
            <td>${item.DOLocationID}</td>
            <td>${Number(item.trip_distance).toFixed(2)}</td>
            <td class="fare">$${Number(item.fare_amount).toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}

function formatDateTime(dt) {
    if (!dt) return "—";
    const d = new Date(dt);
    if (isNaN(d)) return dt;
    return d.toLocaleString("en-US", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

/* ── Charts ──────────────────────────────────────────────────── */
function updateCharts(data) {
    if (barChart)  barChart.destroy();
    if (lineChart) lineChart.destroy();

    const labels   = data.map(d => "Vendor " + d.VendorID);
    const averages = data.map(d => parseFloat(d.avg_price).toFixed(2));
    const mins     = data.map(d => parseFloat(d.min_price).toFixed(2));
    const maxes    = data.map(d => parseFloat(d.max_price).toFixed(2));

    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                labels: { font: { family: "DM Mono", size: 12 }, color: "#555" }
            }
        },
        scales: {
            x: { ticks: { font: { family: "DM Mono" }, color: "#666" }, grid: { color: "#f0f0f0" } },
            y: { ticks: { font: { family: "DM Mono" }, color: "#666" }, grid: { color: "#f0f0f0" } }
        }
    };

    // Bar chart: avg fare per vendor
    barChart = new Chart(document.getElementById("barChart"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Average Fare ($)",
                data: averages,
                backgroundColor: ["rgba(30,90,200,0.75)", "rgba(220,60,60,0.75)"],
                borderColor:     ["rgba(30,90,200,1)",    "rgba(220,60,60,1)"],
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: chartDefaults
    });

    // Line chart: min / avg / max per vendor
    lineChart = new Chart(document.getElementById("lineChart"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Min Fare",
                    data: mins,
                    borderColor: "rgba(80,180,120,1)",
                    backgroundColor: "rgba(80,180,120,0.08)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 5
                },
                {
                    label: "Avg Fare",
                    data: averages,
                    borderColor: "rgba(30,90,200,1)",
                    backgroundColor: "rgba(30,90,200,0.08)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 5
                },
                {
                    label: "Max Fare",
                    data: maxes,
                    borderColor: "rgba(220,60,60,1)",
                    backgroundColor: "rgba(220,60,60,0.08)",
                    fill: true,
                    tension: 0.35,
                    pointRadius: 5
                }
            ]
        },
        options: chartDefaults
    });
}

// script.js
const toggleBtn = document.getElementById('toggle-mode');
const htmlElement = document.documentElement; // Target the <html> element

const currentTheme = localStorage.getItem('theme'); // Get saved theme from localStorage

// Apply saved theme on page load, or default to system preference if no theme saved
if (currentTheme) {
    htmlElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'dark') {
        toggleBtn.textContent = 'Switch to Light Mode';
    }
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Detect OS preference if no localStorage item is found
    htmlElement.setAttribute('data-theme', 'dark');
    toggleBtn.textContent = 'Switch to Light Mode';
}

// Add an event listener to the toggle button
toggleBtn.addEventListener('click', () => {
    let theme = htmlElement.getAttribute('data-theme');
    if (theme === 'light') {
        theme = 'dark';
        toggleBtn.textContent = 'Switch to Light Mode';
    } else {
        theme = 'light';
        toggleBtn.textContent = 'Switch to Dark Mode';
    }
    htmlElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme); // Save the new preference
});

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", applyFilters);