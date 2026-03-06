import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import pqUpgrades from './pq_upgrades.json';


class Quarters extends React.Component {
  constructor() {
    pqUpgrades
  }
}


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
