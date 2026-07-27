import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import './FireChart.css';

const FireChart = ({ fires, darkMode }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Nettoyer l'ancien graphique
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    // Compter par date
    const counts = {};
    fires.forEach(f => {
      const date = f.acq_date || 'unknown';
      counts[date] = (counts[date] || 0) + 1;
    });

    const labels = Object.keys(counts).sort();
    const data = labels.map(d => counts[d]);

    if (labels.length === 0) {
      return;
    }

    const textColor = darkMode ? '#ddd' : '#333';
    const gridColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Nombre de feux',
          data,
          backgroundColor: 'rgba(230, 126, 34, 0.6)',
          borderColor: '#e67e22',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Évolution temporelle des feux',
            color: textColor
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Nombre de feux',
              color: textColor
            },
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          x: {
            title: {
              display: true,
              text: 'Date',
              color: textColor
            },
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [fires, darkMode]);

  return (
    <div className="fire-chart">
      <canvas ref={chartRef} />
    </div>
  );
};

export default FireChart;
