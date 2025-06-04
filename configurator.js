const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_FILE = 'services_config.json';
const COMPOSE_FILE = 'docker-compose.yml';

function loadCompose() {
  const doc = yaml.load(fs.readFileSync(COMPOSE_FILE, 'utf8'));
  const services = doc.services || {};
  const map = {};
  for (const [name, conf] of Object.entries(services)) {
    let deps = [];
    const d = conf.depends_on;
    if (Array.isArray(d)) {
      deps = d;
    } else if (d && typeof d === 'object') {
      deps = Object.keys(d);
    }
    map[name] = deps;
  }
  return map;
}

function loadConfig() {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data).services || [];
  } catch {
    return [];
  }
}

function saveConfig(list) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ services: list }, null, 2));
}

function addDeps(selected, map) {
  const set = new Set(selected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const svc of Array.from(set)) {
      for (const dep of map[svc] || []) {
        if (!set.has(dep)) {
          set.add(dep);
          changed = true;
        }
      }
    }
  }
  return Array.from(set).sort();
}

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  const map = loadCompose();
  const selected = loadConfig();
  res.render('index', { services: Object.keys(map).sort(), selected, saved: false });
});

app.post('/', (req, res) => {
  const map = loadCompose();
  let selected = req.body.services || [];
  if (!Array.isArray(selected)) selected = [selected];
  selected = addDeps(selected, map);
  saveConfig(selected);
  res.render('index', { services: Object.keys(map).sort(), selected, saved: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Configurator running on port ${port}`));
